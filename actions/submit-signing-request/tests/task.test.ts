import { Task } from '../task';

import axios from 'axios';
import sinon from 'sinon';
import assert from 'assert';
import nock from 'nock';
import * as core from '@actions/core';
import { HelperInputOutput } from '../helper-input-output';
import { HelperArtifactDownload } from '../helper-artifact-download';
import axiosRetry from 'axios-retry';
import { SigningRequestStatusDto } from '../dtos/signing-request-status';

const testSignPathApiToken = 'TEST_TOKEN';
const testSigningRequestId = 'TEST_ID';
const testConnectorUrl = 'https://domain';
const testSigningRequestUrl = testConnectorUrl + '/SigningRequests';
const testGitHubArtifactId = 'TEST_ARTIFACT_ID';
const testArtifactConfigurationSlug = 'TEST_ARTIFACT_CONFIGURATION_SLUG';
const testOrganizationId = 'TEST_ORGANIZATION_ID';
const testProjectSlug = 'TEST_PROJECT_SLUG';
const testSigningPolicySlug = 'TEST_POLICY_SLUG';
const testGitHubToken = 'TEST_GITHUB_TOKEN';
const testConnectorLogMessage = 'TEST_CONNECTOR_LOG_MESSAGE';

const testSignedArtifactLink = `${testConnectorUrl}/${testOrganizationId}/SigningRequests/${testSigningRequestId}/SignedArtifact?api-version=1.0`
const submitSigningRequestRouteTemplate = new RegExp(`\/${testOrganizationId}\/SigningRequests.*`)

const defaultTestInputMap = {
    'wait-for-completion': 'true',
    'connector-url': testConnectorUrl,
    'wait-for-completion-timeout-in-seconds': '60',
    'download-signed-artifact-timeout-in-seconds': '60',
    'service-unavailable-timeout-in-seconds': '60',
    'api-token': testSignPathApiToken,
    'github-artifact-id': testGitHubArtifactId,
    'github-token': testGitHubToken,
    'organization-id': testOrganizationId,
    'project-slug': testProjectSlug,
    'signing-policy-slug': testSigningPolicySlug,
    'artifact-configuration-slug': testArtifactConfigurationSlug,
    'parameters': 'param1: "value1"'
};

const sandbox = sinon.createSandbox();

let helperInputOutput: HelperInputOutput;
let helperArtifactDownload: HelperArtifactDownload;
let task: Task;

let axiosPostStub: sinon.SinonStub;
let axiosGetStub: sinon.SinonStub;
let setOutputStub: sinon.SinonStub;
let getInputStub: sinon.SinonStub;

beforeEach(() => {
    const submitSigningRequestResponse = {
        signingRequestUrl: testSigningRequestUrl,
        signingRequestId: testSigningRequestId,
        isFinalStatus: true,
        status: 'Completed',
        unsignedArtifactLink: "unused",
        signedArtifactLink: "unused",
        logs: [{ message: testConnectorLogMessage, level: 'Information' }]
    };

    const getSigningRequestStatusResponse: SigningRequestStatusDto = {
        status: submitSigningRequestResponse.status,
        hasArtifactBeenDownloadedBySignPathInCaseOfArtifactRetrieval: true,
        isFinalStatus: true,
        webLink: testSigningRequestUrl
    }

    axiosPostStub = sandbox.stub(axios, 'post').resolves({ data: submitSigningRequestResponse });
    axiosGetStub = sandbox.stub(axios, 'get').resolves({ data: getSigningRequestStatusResponse });
    setOutputStub = sandbox.stub(core, 'setOutput');

    // set input stubs to return default values
    getInputStub = sandbox.stub(core, 'getInput').callsFake((paramName) => {
        return defaultTestInputMap[paramName as keyof typeof defaultTestInputMap] || 'test';
    });

    helperInputOutput = new HelperInputOutput();
    helperArtifactDownload = new HelperArtifactDownload(helperInputOutput);
    // artifact downloading is mocked
    sandbox.stub(helperArtifactDownload, 'downloadSignedArtifact').resolves();
    task = new Task(helperInputOutput, helperArtifactDownload, {
        MinDelayBetweenSigningRequestStatusChecksInSeconds: 0,
        MaxDelayBetweenSigningRequestStatusChecksInSeconds: 0,
        CheckArtifactDownloadStatusIntervalInSeconds: 0
    });
});

afterEach(() => {
    sandbox.restore();
});

it('test that the task fails if the signing request submit fails', async () => {
    const submitSigningRequestErrorResponse = {
        error: 'Failed'
    };
    axiosPostStub.restore(); // we don't need default stub behavior in this test
    sandbox.stub(axios, 'post').resolves({ data: submitSigningRequestErrorResponse });
    const setFailedStub = sandbox.stub(core, 'setFailed');
    await task.run();
    assert.equal(setFailedStub.calledOnce, true);
});

it('test that the task fails if the signing request has "Failed" as a final status', async () => {
    const setFailedStub = sandbox.stub(core, 'setFailed')
        .withArgs(sinon.match((value: any) => {
            return value.includes('TEST_FAILED')
                && value.includes('The signing request is not completed.');
        }));

    const failedStatusSigningRequestResponse = {
        status: 'TEST_FAILED',
        isFinalStatus: true,
    };
    axiosGetStub.restore(); // we don't need default stub behavior in this test
    sandbox.stub(axios, 'get').resolves({ data: failedStatusSigningRequestResponse });

    await task.run();
    assert.equal(setFailedStub.calledOnce, true, 'setFailed should be called once');
});

it('test that the signing request was not submitted due to validation errors', async () => {
    const submitSigningRequestValidationErrorResponse = {
        validationResult: {
            errors: [
                {
                    error: 'TEST_ERROR',
                    howToFix: 'TEST_FIX'
                }
            ]
        }
    };
    axiosPostStub.restore(); // we don't need default stub behavior in this test
    sandbox.stub(axios, 'post').resolves({ data: submitSigningRequestValidationErrorResponse });
    // check that task was marked as failed, because of validation errors
    const setFailedStub = sandbox.stub(core, 'setFailed')
        .withArgs(sinon.match((value: any) => {
            return value.includes('CI system validation failed');
        }));
    // check that error message was logged
    const errorLogStub = sandbox.stub(core, 'error')
        .withArgs(sinon.match((value: any) => {
            return value.includes('TEST_ERROR');
        }));
    // check that howToFix message was logged
    const coreInfoStub = sandbox.stub(core, 'info')
        .withArgs(sinon.match((value: any) => {
            return value.includes('TEST_FIX');
        }));

    await task.run();
    assert.equal(setFailedStub.calledOnce, true);
    assert.equal(errorLogStub.called, true);
    assert.equal(coreInfoStub.called, true);
});

it('connector logs logged to the build log', async () => {
    const coreInfoStub = sandbox.stub(core, 'info')
        .withArgs(sinon.match((value: any) => {
            return value.includes(testConnectorLogMessage);
        }));
    await task.run();
    assert.equal(coreInfoStub.called, true);
});

it('test that the connectors url has api version', async () => {
    await task.run();
    assert.equal(axiosPostStub.calledWith(
        sinon.match((value: any) => {
            return value.indexOf('api-version') !== -1;
        })), true);
});

it('test if input variables are passed through', async () => {
    await task.run();
    assert.equal(axiosPostStub.calledWith(
        sinon.match.any,
        sinon.match((value: any) => {
            return value.artifactId === testGitHubArtifactId
                && value.signPathProjectSlug === testProjectSlug
                && value.signPathSigningPolicySlug === testSigningPolicySlug
                && value.gitHubToken === testGitHubToken
                && value.signPathArtifactConfigurationSlug === testArtifactConfigurationSlug
                && value.parameters.length === 1
                && value.parameters[0].name === 'param1'
                && value.parameters[0].value === 'value1'
        })), true);
});

it('task fails if the submit request connector fails', async () => {
    axiosPostStub.restore(); // we don't need default stub behavior in this test
    const httpCallError = 'Http call error';
    sandbox.stub(axios, 'post').callsFake(async (url, data, config) => {
        throw { response: { data: httpCallError } };
    });
    const setFailedStub = sandbox.stub(core, 'setFailed')
        .withArgs(sinon.match((value: string) => {
            return value.indexOf(httpCallError) !== -1;
        }));
    await task.run();
    assert.equal(setFailedStub.calledOnce, true);
});

it('if submit signing request fails with 429,502,503,504 the task retries', async () => {
    // use real *POST* axios for this test, because retries are implemented in axios
    axiosPostStub.restore();

    const retryTestId = 'RETRY_TEST_ID';
    const addErrorResponse = (httpCode: number) => {
        nock(testConnectorUrl).post(submitSigningRequestRouteTemplate).once().reply(httpCode, 'Server Error');
    }

    addErrorResponse(429);
    addErrorResponse(502);
    addErrorResponse(503);
    addErrorResponse(504);

    nock(testConnectorUrl)
        .post(submitSigningRequestRouteTemplate)
        .reply(200, {
            signingRequestUrl: testSigningRequestUrl,
            signingRequestId: retryTestId
        });

    // disable exponential delay to speed up the test
    sandbox.stub(axiosRetry, 'exponentialDelay').resolves(0)

    await task.run();

    // signing request id should be set in the output
    assert.equal(setOutputStub.calledWith('signing-request-id', retryTestId), true);
});

it('no retries for http code 500', async () => {
    // use real *POST* axios for this test, because retries are implemented in axios
    axiosPostStub.restore();

    nock(testConnectorUrl).post(submitSigningRequestRouteTemplate).reply(500, 'Server Error');

    const setFailedStub = sandbox.stub(core, 'setFailed');
    await task.run();
    assert.equal(setFailedStub.calledOnce, true);
});

it('task waits for unsigned artifact being downloaded by SignPath before completing', async () => {

    // use non stubbed axios, define responses sequence suing nock
    axiosGetStub.restore();

    // non-default input map, with 'wait-for-completion' set to 'false'
    getInputStub.restore();
    const input = Object.assign({}, defaultTestInputMap);
    input['wait-for-completion'] = 'false';
    getInputStub = sandbox.stub(core, 'getInput').callsFake((paramName) => {
        return input[paramName as keyof typeof input] || 'test';
    });

    const addGetRequestDataResponse = (hasArtifactBeenDownloadedBySignPathInCaseOfArtifactRetrieval: boolean) => {
        return nock(testConnectorUrl).get(uri => uri.includes('SigningRequests')).once().reply(200, {
            hasArtifactBeenDownloadedBySignPathInCaseOfArtifactRetrieval
        });
    }

    const nockScopes = [];

    // artifact is not downloaded for the first 4 calls
    nockScopes.push(addGetRequestDataResponse(false));
    nockScopes.push(addGetRequestDataResponse(false));
    nockScopes.push(addGetRequestDataResponse(false));
    nockScopes.push(addGetRequestDataResponse(false));

    // artifact is downloaded when the 5th call happens
    nockScopes.push(addGetRequestDataResponse(true));
    // this request should not happen
    // because it should stop checking after the previous request
    const notDoneScope = addGetRequestDataResponse(false);

    const setFailedStub = sandbox.stub(core, 'setFailed');
    await task.run();

    nockScopes.forEach(scope => scope.done());

    // and successfully completed
    assert.equal(setFailedStub.called, false);
    assert.equal(notDoneScope.isDone(), false);
});

it('if the signing request status is final, the task stops checking for artifact download status and reports an error', async () => {

    // use non stubbed axios, define responses sequence using nock
    axiosGetStub.restore();

    // non-default input map, with 'wait-for-completion' set to 'false'
    getInputStub.restore();
    const input = Object.assign({}, defaultTestInputMap);
    input['wait-for-completion'] = 'false';
    getInputStub = sandbox.stub(core, 'getInput').callsFake((paramName) => {
        return input[paramName as keyof typeof input] || 'test';
    });

    // signing request status is final and artifact is not downloaded
    // something went wrong, the sining request cannot be completed
    nock(testConnectorUrl).get(uri => uri.includes('SigningRequests')).once().reply(200, {
        hasArtifactBeenDownloadedBySignPathInCaseOfArtifactRetrieval: false,
        isFinalStatus: true
    });

    const setFailedStub = sandbox.stub(core, 'setFailed');
    await task.run();

    // and successfully completed
    assert.equal(setFailedStub.called, true);
});

it('test that the output variables are set correctly', async () => {
    await task.run();

    assert.equal(setOutputStub.calledWith('signing-request-id', testSigningRequestId), true);
    assert.equal(setOutputStub.calledWith('signing-request-web-url', testSigningRequestUrl), true);
    assert.equal(setOutputStub.calledWith('signed-artifact-download-url', testSignedArtifactLink), true);
});