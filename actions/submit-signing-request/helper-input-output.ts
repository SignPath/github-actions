import * as core from '@actions/core';
import { getInputNumber, parseUserDefinedParameters } from './utils';

export class HelperInputOutput {

    get signPathConnectorUrl(): string {
        return core.getInput('connector-url', { required: true });
    }

    get githubArtifactId(): string {
        return core.getInput('github-artifact-id', { required: true });
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
        return core.getInput('github-token', { required: true });
    }

    get gitHubExtendedVerificationToken(): string {
        return core.getInput('github-extended-verification-token', { required: false });
    }

    get parameters(): {name:string, value: string}[] {
        const value = core.getInput('parameters', { required: false });
        return parseUserDefinedParameters(value);
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
