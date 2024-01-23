import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import * as core from '@actions/core';
import * as moment from 'moment';


import url from 'url';
import { SubmitSigningRequestResult, ValidationResult } from './dtos/submit-signing-request-result';
import { executeWithRetries, httpErrorResponseToText } from './utils';
import { SignPathUrlBuilder } from './signpath-url-builder';
import { SigningRequestDto } from './dtos/signing-request';
import { HelperInputOutput } from './helper-input-output';
import { taskVersion } from './version';
import { HelperArtifactDownload } from './helper-artifact-download';

const MinDelayBetweenSigningRequestStatusChecksInSeconds = 10; // start from 10 sec
const MaxDelayBetweenSigningRequestStatusChecksInSeconds = 60 * 20; // check at least every 30 minutes

// output variables
// signingRequestId - the id of the newly created signing request
// signingRequestWebUrl - the url of the signing request in SignPath
// signPathApiUrl - the base API url of the SignPath API
// signingRequestDownloadUrl - the url of the signed artifact in SignPath

export class Task {
    urlBuilder: SignPathUrlBuilder;

    constructor (
        private helperInputOutput: HelperInputOutput,
        private helperArtifactDownload: HelperArtifactDownload) {
        this.urlBuilder = new SignPathUrlBuilder(this.helperInputOutput.signPathConnectorUrl);
    }

    async run() {

        this.configureAxios();

        try {
            const signingRequestId = await this.submitSigningRequest();

            if (this.helperInputOutput.waitForCompletion) {
                const signingRequest = await this.ensureSigningRequestCompleted(signingRequestId);
                this.helperInputOutput.setSignedArtifactDownloadUrl(signingRequest.signedArtifactLink);
                await this.helperArtifactDownload.downloadArtifact(signingRequest.signedArtifactLink);
            }
        }
        catch (err) {
            core.setFailed((err as any).message);
        }
    }

    private async submitSigningRequest (): Promise<string> {

        core.info('Submitting the signing request to SignPath CI connector...');

        // prepare the payload
        const submitRequestPayload = this.buildSigningRequestPayload();

        // call the signPath API to submit the signing request
        const response = (await axios
            .post<SubmitSigningRequestResult>(this.urlBuilder.buildSubmitSigningRequestUrl(),
            submitRequestPayload,
            { responseType: "json" })
            .catch((e: AxiosError) => {
                core.error(`SignPath API call error: ${e.message}`);
                throw new Error(httpErrorResponseToText(e));
            }))
            .data;

        if (response.error) {
            // got error from the connector
            throw new Error(response.error);
        }

        this.checkResponseStructure(response);
        this.checkCiSystemValidationResult(response.validationResult);

        const signingRequestUrlObj  = url.parse(response.signingRequestUrl);
        this.urlBuilder.signPathBaseUrl = signingRequestUrlObj.protocol + '//' + signingRequestUrlObj.host;

        core.info(`SignPath signing request has been successfully submitted`);
        core.info(`The signing request id is ${response.signingRequestId}`);
        core.info(`You can view the signing request here: ${response.signingRequestUrl}`);

        this.helperInputOutput.setSigningRequestId(response.signingRequestId);
        this.helperInputOutput.setSigningRequestWebUrl(response.signingRequestUrl);
        this.helperInputOutput.setSignPathApiUrl(this.urlBuilder.signPathBaseUrl + '/API');

        return response.signingRequestId;
    }

    private checkCiSystemValidationResult(validationResult: ValidationResult): void {
        if (validationResult && validationResult.errors.length > 0) {

            // got validation errors from the connector
            core.startGroup('CI system setup validation errors')

            core.error(`[error]Build artifact \"${this.helperInputOutput.githubArtifactName}\" cannot be signed because of continuous integration system setup validation errors:`);

            validationResult.errors.forEach(validationError => {
                core.error(`[error]${validationError.error}`);
                if (validationError.howToFix)
                {
                    core.info(validationError.howToFix);
                }
            });

            core.endGroup()

            throw new Error("CI system validation failed.");
        }
    }

    private async ensureSigningRequestCompleted(signingRequestId: string): Promise<SigningRequestDto> {
        // check for status update
        core.info(`Checking the signing request status...`);
        const requestData = await (executeWithRetries<SigningRequestDto>(
            async () => {
                const requestStatusUrl = this.urlBuilder.buildGetSigningRequestUrl(
                    this.helperInputOutput.organizationId, signingRequestId);

                const signingRequestDto = (await axios
                    .get<SigningRequestDto>(
                        requestStatusUrl,
                        {
                            responseType: "json",
                            headers: {
                                "Authorization": `Bearer ${this.helperInputOutput.signPathApiToken}`
                            }
                        }
                    )
                    .catch((e: AxiosError) => {
                        core.error(`SignPath API call error: ${e.message}`);
                        core.error(`Signing request details API URL is: ${requestStatusUrl}`);
                        throw new Error(httpErrorResponseToText(e));
                    })
                    .then((response) => {
                        const data = response.data;
                        if(data && !data.isFinalStatus) {
                            core.info(`The signing request status is ${data.status}, which is not a final status; after a delay, we will check again...`);
                            throw new Error('Retry signing request status check.');
                        }
                        return data;
                    }));
                return signingRequestDto;
            },
            this.helperInputOutput.waitForCompletionTimeoutInSeconds * 1000,
            MinDelayBetweenSigningRequestStatusChecksInSeconds * 1000,
            MaxDelayBetweenSigningRequestStatusChecksInSeconds * 1000)
            .catch((e) => {
                if(e.message.startsWith('{')) {
                    const errorData = JSON.parse(e.message);
                    return errorData.data;
                }
                throw e;
            }));

        core.info(`Signing request status is ${requestData.status}`);
        if (!requestData.isFinalStatus) {
            const maxWaitingTime = moment.utc(this.helperInputOutput.waitForCompletionTimeoutInSeconds * 1000).format("hh:mm");
            core.error(`We have exceeded the maximum waiting time, which is ${maxWaitingTime}, and the signing request is still not in a final state`);
            throw new Error(`The signing request is not completed. The current status is "${requestData.status}`);
        } else {
            if (requestData.status !== "Completed") {
                throw new Error(`The signing request is not completed. The final status is "${requestData.status}"`);
            }
        }

        return requestData;
    }

    private configureAxios(): void {
        // set retries
        // the delays are powers of 2 in seconds, with 20% jitter
        // we want to cover 10 minutes of SignPath service unavailability
        // so we need to do 10 retries
        // sum of 2^0 + 2^1 + ... + 2^9 = 1023 = 17 minutes
        // nine retries will not be enough to cover 10 minutes downtime

        const maxRetryCount = 10;
        axiosRetry(axios, {
            retryDelay: axiosRetry.exponentialDelay,
            retries: maxRetryCount
        });

        // set user agent
        axios.defaults.headers.common['User-Agent'] = this.buildUserAgent();
    }

    private buildUserAgent(): string {
        const userAgent = `SignPath.SubmitSigningRequestGitHubAction/${taskVersion}(NodeJS/${process.version}; ${process.platform} ${process.arch}})`;
        return userAgent;
    }

    private checkResponseStructure(response: SubmitSigningRequestResult): void {
        if (!response.validationResult && !response.signingRequestId) {

            // if neither validationResult nor signingRequestId are present,
            // then the response might be not from the connector
            throw new Error(`SignPath signing request was not created. Please make sure that connector-url is pointing to the SignPath GitHub Actions connector endpoint.`);
        }
    }

    private buildSigningRequestPayload(): any {
        return {
            apiToken: this.helperInputOutput.signPathApiToken,
            artifactName: this.helperInputOutput.githubArtifactName,
            gitHubApiUrl: process.env.GITHUB_API_URL,
            gitHubWorkflowRunId: process.env.GITHUB_RUN_ID,
            gitHubRepository: process.env.GITHUB_REPOSITORY,
            gitHubToken: this.helperInputOutput.gitHubToken,
            signPathOrganizationId: this.helperInputOutput.organizationId,
            signPathProjectSlug: this.helperInputOutput.projectSlug,
            signPathSigningPolicySlug: this.helperInputOutput.signingPolicySlug,
            signPathArtifactConfigurationSlug: this.helperInputOutput.artifactConfigurationSlug
        };
    }
}

