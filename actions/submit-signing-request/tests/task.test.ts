import { Task } from '../task';

import axios from 'axios';
import sinon from 'sinon';
import assert from 'assert';
import nock from 'nock';
import * as core from '@actions/core';
import { HelperInputOutput } from '../helper-input-output';
import { HelperArtifactDownload } from '../helper-artifact-download';
import axiosRetry from 'axios-retry';

const testApiToken = 'TEST_TOKEN';
const testSigningRequestId = 'TEST_ID';
const testConnectorUrl = 'https://domain';
const testSigningRequestUrl = testConnectorUrl + '/api/SigningRequests';
const testSignedArtifactLink = testConnectorUrl + '/api/artifactlink';
const testGitHubArtifactName = 'TEST_ARTIFACT_NAME';
const testArtifactConfigurationSlug = 'TEST_ARTIFACT_CONFIGURATION_SLUG';
const testOrganizationId = 'TEST_ORGANIZATION_ID';
const testProjectSlug = 'TEST_PROJECT_SLUG';
const testSigningPolicySlug = 'TEST_POLICY_SLUG';
const testGitHubToken = 'TEST_GITHUB_TOKEN';

const sandbox = sinon.createSandbox();

let helperInputOutput: HelperInputOutput;
let helperArtifactDownload: HelperArtifactDownload;
let task: Task;

let axiosPostStub: sinon.SinonStub;
let axiosGetStub: sinon.SinonStub;
let setOutputStub: sinon.SinonStub;

beforeEach(() => {

    const submitSigningRequestResponse = {
        signingRequestUrl: testSigningRequestUrl,
        signingRequestId: testSigningRequestId,
        isFinalStatus: true,
        status: 'Completed',
        signedArtifactLink: testSignedArtifactLink
    };

    const getSigningRequestResponse = submitSigningRequestResponse;

    axiosPostStub = sandbox.stub(axios, 'post').resolves({ data: submitSigningRequestResponse });
    axiosGetStub = sandbox.stub(axios, 'get').resolves({ data: getSigningRequestResponse });
    setOutputStub = sandbox.stub(core, 'setOutput');

    // set input stubs to return default values
    sandbox.stub(core, 'getInput').callsFake((paramName) => {
        switch (paramName) {
            case 'wait-for-completion':
                return 'true';
            case 'connector-url':
                return testConnectorUrl;
            case 'wait-for-completion-timeout-in-seconds':
                return '60';
            case 'download-signed-artifact-timeout-in-seconds':
                return '60';
            case 'service-unavailable-timeout-in-seconds':
                return '60';
            case 'api-token':
                return testApiToken;
            case 'github-artifact-name':
                return testGitHubArtifactName;
            case 'github-token':
                return testGitHubToken;
            case 'organization-id':
                return testOrganizationId;
            case 'project-slug':
                return testProjectSlug;
            case 'signing-policy-slug':
                return testSigningPolicySlug;
            case 'artifact-configuration-slug':
                return testArtifactConfigurationSlug;
            default:
                return 'test';
        }
    });

    helperInputOutput = new HelperInputOutput();
    helperArtifactDownload = new HelperArtifactDownload(helperInputOutput);
    // artifact downloading is mocked
    sandbox.stub(helperArtifactDownload, 'downloadSignedArtifact').resolves();
    task = new Task(helperInputOutput, helperArtifactDownload);

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
        .withArgs(sinon.match((value:any) => {
            return value.includes('TEST_FAILED')
            && value.includes('The signing request is not completed.');
        }));

    const failedStatusSigningRequestResponse = {
        status: 'TEST_FAILED',
        isFinalStatus: true
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
        .withArgs(sinon.match((value:any) => {
            return value.includes('CI system validation failed');
        }));
    // check that error message was logged
    const errorLogStub = sandbox.stub(core, 'error')
        .withArgs(sinon.match((value:any) => {
            return value.includes('TEST_ERROR');
        }));
    // check that howToFix message was logged
    const infoLogStub = sandbox.stub(core, 'info')
        .withArgs(sinon.match((value:any) => {
            return value.includes('TEST_FIX');
        }));

    await task.run();
    assert.equal(setFailedStub.calledOnce, true);
    assert.equal(errorLogStub.called, true);
    assert.equal(infoLogStub.called, true);
});

it('test that the output variables are set correctly', async () => {
    await task.run();
    assert.equal(setOutputStub.calledWith('signing-request-id',  testSigningRequestId), true);
    assert.equal(setOutputStub.calledWith('signing-request-web-url', testSigningRequestUrl), true);
    assert.equal(setOutputStub.calledWith('signpath-api-url', 'https://domain/API'), true);
    assert.equal(setOutputStub.calledWith('signed-artifact-download-url', testSignedArtifactLink), true);
});

it('test if input variables are passed through', async () => {
    await task.run();
    assert.equal(axiosPostStub.calledWith(
        sinon.match.any,
        sinon.match((value:any) => {
            return value.apiToken === testApiToken
                && value.signPathOrganizationId === testOrganizationId
                && value.artifactName === testGitHubArtifactName
                && value.signPathProjectSlug === testProjectSlug
                && value.signPathSigningPolicySlug === testSigningPolicySlug
                && value.gitHubToken === testGitHubToken
                && value.signPathArtifactConfigurationSlug === testArtifactConfigurationSlug;
        })), true);
});

it('task fails if the submit request connector fails', async () => {
    axiosPostStub.restore(); // we don't need default stub behavior in this test
    const httpCallError = 'Http call error';
    sandbox.stub(axios, 'post').callsFake(async (url, data, config) => {
        throw { response: { data: httpCallError } };
    });
    const setFailedStub = sandbox.stub(core, 'setFailed')
        .withArgs(sinon.match((value:string) => {
            return value.indexOf(httpCallError) !== -1;
        }));
    await task.run();
    assert.equal(setFailedStub.calledOnce, true);
});

it('if submit signing request fails with 500, the task retries', async () => {
    // use real axios for this test, because retries are implemented in axios
    axiosPostStub.restore();

    // fail twice, then succeed
    nock(testConnectorUrl)
        .post('/api/sign')
        .twice()
        .reply(500, 'Internal Server Error');
    nock(testConnectorUrl)
        .post('/api/sign')
        .twice()
        .reply(200, {
            signingRequestUrl: testSigningRequestUrl,
            signingRequestId: testSigningRequestId,
            isFinalStatus: true,
            status: 'Completed',
            signedArtifactLink: testSignedArtifactLink
        });

    // we use real axios, so need to mock also a call to get signing request status
    nock(testConnectorUrl)
        .get(/SigningRequests/)
        .reply(200, {
            status: 'Completed',
            isFinalStatus: true,
            signedArtifactLink: testSignedArtifactLink
        });

    // disable exponential delay to speed up the test
    sandbox.stub(axiosRetry, 'exponentialDelay').resolves(0)

    await task.run();

    // signing request id should be set in the output
    assert.equal(setOutputStub.calledWith('signing-request-id',  testSigningRequestId), true);
});
