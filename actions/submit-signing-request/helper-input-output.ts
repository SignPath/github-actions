import * as core from '@actions/core';
import { getInputNumber } from './utils';

export class HelperInputOutput {

    get signPathConnectorUrl(): string {
        return core.getInput('connector-url', { required: true });
    }

    get githubArtifactName(): string {
        return core.getInput('github-artifact-name', { required: true });
    }

    get outputArtifactDirectory(): string {
        return core.getInput('output-artifact-directory', { required: false });
    }

    get waitForCompletion(): boolean {
        return core.getInput('wait-for-completion', { required: true }) === 'true';
    }

    get organizationId(): string {
        return core.getInput('organization-id', { required: true });
    }

    get signPathApiToken(): string {
        return core.getInput('api-token', { required: true });
    }

    get projectSlug(): string {
        return core.getInput('project-slug', { required: true });
    }

    get gitHubToken(): string {
        // get user provided a github-token
        // with fallback to system generated GITHUB_TOKEN
        return core.getInput('github-token', { required: false })
            ?? core.getInput('GITHUB-TOKEN');
    }

    get gitHubExtendedVerificationToken(): string {
        return core.getInput('github-extended-verification-token', { required: false });
    }

    get signingPolicySlug(): string {
        return core.getInput('signing-policy-slug', { required: true });
    }

    get artifactConfigurationSlug(): string {
        return core.getInput('artifact-configuration-slug', { required: false });
    }

    get waitForCompletionTimeoutInSeconds(): number {
        return getInputNumber('wait-for-completion-timeout-in-seconds', { required: true });
    }

    get downloadSignedArtifactTimeoutInSeconds(): number {
        return getInputNumber('download-signed-artifact-timeout-in-seconds', { required: true });
    }

    get serviceUnavailableTimeoutInSeconds(): number {
        return getInputNumber('service-unavailable-timeout-in-seconds', { required: true });
    }

    setSignedArtifactDownloadUrl(url: string):void {
        core.setOutput('signed-artifact-download-url', url);
    }

    setSigningRequestId(signingRequestId: string): void {
        core.setOutput('signing-request-id', signingRequestId);
    }

    setSigningRequestWebUrl(signingRequestUrl: string): void {
        core.setOutput('signing-request-web-url', signingRequestUrl);
    }

    setSignPathApiUrl(signingRequestUrl: string): void {
        core.setOutput('signpath-api-url', signingRequestUrl);
    }
}