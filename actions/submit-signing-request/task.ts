import axios, { AxiosError, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import * as core from '@actions/core';
import * as moment from 'moment';
import url from 'url';

import { LogEntry, LogLevelDebug, LogLevelError, LogLevelInformation, LogLevelWarning, SubmitSigningRequestResult, ValidationResult } from './dtos/submit-signing-request-result';
import { buildSignPathAuthorizationHeader, executeWithRetries, httpErrorResponseToText } from './utils';
import { SignPathUrlBuilder } from './signpath-url-builder';
import { SigningRequestDto } from './dtos/signing-request';
import { HelperInputOutput } from './helper-input-output';
import { taskVersion } from './version';
import { HelperArtifactDownload } from './helper-artifact-download';
import { Config } from './config';

// output variables
// signingRequestId - the id of the newly created signing request
// signingRequestWebUrl - the url of the signing request in SignPath
// signPathApiUrl - the base API url of the SignPath API
// signingRequestDownloadUrl - the url of the signed artifact in SignPath

export class Task {
    urlBuilder: SignPathUrlBuilder;

    constructor (
        private helperInputOutput: HelperInputOutput,
        private helperArtifactDownload: HelperArtifactDownload,
        private config: Config) {
        this.urlBuilder = new SignPathUrlBuilder(this.helperInputOutput.signPathConnectorUrl);
    }

    async run() {

        this.configureAxios();

        try {
            const signingRequestId = await this.submitSigningRequest();

            if (this.helperInputOutput.waitForCompletion) {
                const signingRequest = await this.ensureSigningRequestCompleted(signingRequestId);
                this.helperInputOutput.setSignedArtifactDownloadUrl(signingRequest.signedArtifactLink);

                if(this.helperInputOutput.outputArtifactDirectory) {
                    await this.helperArtifactDownload.downloadSignedArtifact(signingRequest.signedArtifactLink);
                }
            }
            else {
                await this.ensureSignPathDownloadedUnsignedArtifact(signingRequestId);
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

                if(e.code === AxiosError.ERR_BAD_REQUEST) {

                    const connectorResponse = e.response as AxiosResponse<SubmitSigningRequestResult>;

                    if(connectorResponse.data.error) {
                        // when an error occurs in the validator the error details are in the validationResult
                        this.checkCiSystemValidationResult(connectorResponse.data.validationResult);
                        throw new Error(connectorResponse.data.error);
                    }

                    // got validation errors from the connector
                    return connectorResponse;
                }

                core.error(`SignPath API call error: ${e.message}`);
                throw new Error(httpErrorResponseToText(e));
            }))
            .data;

        this.checkResponseStructure(response);
        this.redirectConnectorLogsToActionLogs(response.logs);
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

            core.error(`Build artifact with id \"${this.helperInputOutput.githubArtifactId}\" cannot be signed because of continuous integration system setup validation errors:`);

            validationResult.errors.forEach(validationError => {
                core.error(`${validationError.error}`);
                if (validationError.howToFix)
                {
                    core.info(validationError.howToFix);
                }
            });

            core.endGroup()

            throw new Error("CI system validation failed.");
        }
    }

    // if auto-generated GitHub Actions token (secrets.GITHUB_TOKEN) is used for artifact download,
    // ensure the workflow continues running until the download is complete.
    // The token is valid only for the workflow's duration
    private async ensureSignPathDownloadedUnsignedArtifact(signingRequestId: string): Promise<void> {
        core.info(`Waiting until SignPath downloaded the unsigned artifact...`);
        const requestData = await (executeWithRetries<SigningRequestDto>(
            async () => {
                const signingRequestDto = await (this.getSigningRequest(signingRequestId)
                    .then(data => {
                        if(!data.unsignedArtifactLink  && !data.isFinalStatus) {
                            core.info(`Checking the download status: not yet complete`);
                            // retry artifact download status check
                            return { retry: true };
                        }
                        return { retry: false, result: data };
                    }));
                return signingRequestDto;
            },
            this.helperInputOutput.waitForCompletionTimeoutInSeconds * 1000,
            this.config.CheckArtifactDownloadStatusIntervalInSeconds * 1000,
            this.config.CheckArtifactDownloadStatusIntervalInSeconds * 1000));

        if (!requestData.unsignedArtifactLink) {

            if(!requestData.isFinalStatus) {
                const maxWaitingTime = moment.utc(this.helperInputOutput.waitForCompletionTimeoutInSeconds * 1000).format("hh:mm");
                core.error(`We have exceeded the maximum waiting time, which is ${maxWaitingTime}, and the GitHub artifact is still not downloaded by SignPath`);
            } else {
                core.error(`The signing request is in its final state, but the GitHub artifact has not been downloaded by SignPath.`);
            }
            throw new Error(`The GitHub artifact is not downloaded by SignPath`);
        }
        else {
            core.info(`The unsigned GitHub artifact has been successfully downloaded by SignPath`);
        }
        // else continue workflow execution
        // artifact already downloaded by SignPath
    }

    private async ensureSigningRequestCompleted(signingRequestId: string): Promise<SigningRequestDto> {
        // check for status update
        core.info(`Checking the signing request status...`);
        const requestData = await (executeWithRetries<SigningRequestDto>(
            async () => {

                const signingRequestDto = await (this.getSigningRequest(signingRequestId)
                    .then(data => {
                        if(data && !data.isFinalStatus) {
                            core.info(`The signing request status is ${data.status}, which is not a final status; after a delay, we will check again...`);
                            return { retry: true };
                        }
                        return { retry: false, result: data };
                    }));
                return signingRequestDto;
            },
            this.helperInputOutput.waitForCompletionTimeoutInSeconds * 1000,
            this.config.MinDelayBetweenSigningRequestStatusChecksInSeconds * 1000,
            this.config.MaxDelayBetweenSigningRequestStatusChecksInSeconds * 1000));

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

    private async getSigningRequest(signingRequestId: string): Promise<SigningRequestDto> {
        const requestStatusUrl = this.urlBuilder.buildGetSigningRequestUrl(
            this.helperInputOutput.organizationId, signingRequestId);

        const signingRequestDto = await axios
            .get<SigningRequestDto>(
                requestStatusUrl,
                {
                    responseType: "json",
                    headers: {
                        "Authorization": buildSignPathAuthorizationHeader(this.helperInputOutput.signPathApiToken)
                    }
                }
            )
            .catch((e: AxiosError) => {
                core.error(`SignPath API call error: ${e.message}`);
                core.error(`Signing request details API URL is: ${requestStatusUrl}`);
                throw new Error(httpErrorResponseToText(e));
            })
            .then(response => response.data);
        return signingRequestDto;
    }

    private configureAxios(): void {

        // set user agent
        axios.defaults.headers.common['User-Agent'] = this.buildUserAgent();
        const timeoutMs = this.helperInputOutput.serviceUnavailableTimeoutInSeconds * 1000
        axios.defaults.timeout = timeoutMs;

        // original axiosRetry doesn't work for POST requests
        // thats why we need to override some functions
        axiosRetry.isNetworkOrIdempotentRequestError = (error: AxiosError) => {
            return axiosRetry.isNetworkError(error) || axiosRetry.isIdempotentRequestError(error);
        };

        axiosRetry.isIdempotentRequestError = (error: AxiosError) => {
            if (!error.config?.method) {
                // Cannot determine if the request can be retried
                return false;
            }
            return axiosRetry.isRetryableError(error);
        };

        // by default axiosRetry retries on 5xx errors
        // we want to change this and retry only 502, 503, 504, 429
        axiosRetry.isRetryableError = (error: AxiosError) => {
            let retryableHttpErrorCode = false;

            if(error.response) {
                if(error.response.status === 502
                    || error.response.status === 503
                    || error.response.status === 504) {
                    retryableHttpErrorCode = true;
                    core.info(`SignPath REST API is temporarily unavailable (server responded with ${error.response.status}).`);
                }

                if(error.response.status === 429) {
                    retryableHttpErrorCode = true;
                    core.info('SignPath REST API encountered too many requests.');
                }
            }

            return (error.code !== 'ECONNABORTED' &&
            (!error.response || retryableHttpErrorCode));
        }

        // set retries
        // the delays are powers of 2 * 100ms, with 20% jitter
        // we want to cover 10 minutes of SignPath service unavailability
        // so we need to do 12 retries
        // sum of 2^0 + 2^1 + ... + 2^12 = 2^13 - 1 = 8191
        // 8191 * 100ms = 819.1 seconds = 13.65 minutes
        // 11 retries will not be enough to cover 10 minutes downtime

        const maxRetryCount = 12;
        axiosRetry(axios, {
            retryDelay: axiosRetry.exponentialDelay,
            retries: maxRetryCount,
            retryCondition: axiosRetry.isNetworkOrIdempotentRequestError
        });

    }

    private buildUserAgent(): string {
        const userAgent = `SignPath.SubmitSigningRequestGitHubAction/${taskVersion}(NodeJS/${process.version}; ${process.platform} ${process.arch}})`;
        return userAgent;
    }

    private checkResponseStructure(response: SubmitSigningRequestResult): void {
        if (!response.validationResult && !response.signingRequestId) {

            // if neither validationResult nor signingRequestId are present,
            // then the response might be not from the connector
            core.error(`Unexpected response from the SignPath connector: ${JSON.stringify(response)}`);
            throw new Error(`SignPath signing request was not created. Please make sure that connector-url is pointing to the SignPath GitHub Actions connector endpoint.`);
        }
    }

    private redirectConnectorLogsToActionLogs(logs: LogEntry[]): void {
        if (logs && logs.length > 0) {
            logs.forEach(log => {
                switch (log.level) {
                    case LogLevelDebug:
                        core.debug(log.message);
                        break;
                    case LogLevelInformation:
                        core.info(log.message);
                        break;
                    case LogLevelWarning:
                        core.warning(log.message);
                        break;
                    case LogLevelError:
                        core.error(log.message);
                        break;
                    default:
                        core.info(`${log.level}:${log.message}`);
                        break;
                }
            });
        }
    }

    private buildSigningRequestPayload(): any {
        return {
            signPathApiToken: this.helperInputOutput.signPathApiToken,
            artifactId: this.helperInputOutput.githubArtifactId,
            gitHubWorkflowRunId: process.env.GITHUB_RUN_ID,
            gitHubRepository: process.env.GITHUB_REPOSITORY,
            gitHubRepositoryOwner: process.env.GITHUB_REPOSITORY_OWNER,
            gitHubToken: this.helperInputOutput.gitHubToken,
            signPathOrganizationId: this.helperInputOutput.organizationId,
            signPathProjectSlug: this.helperInputOutput.projectSlug,
            signPathSigningPolicySlug: this.helperInputOutput.signingPolicySlug,
            signPathArtifactConfigurationSlug: this.helperInputOutput.artifactConfigurationSlug,
            parameters: this.helperInputOutput.parameters
        };
    }
}

