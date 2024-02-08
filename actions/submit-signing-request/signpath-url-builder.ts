export class SignPathUrlBuilder {

    public signPathApiBaseUrl: string = 'https://signpath.io/Api';

    constructor(
        private signPathGitHubConnectorBaseUrl: string) {
        this.signPathGitHubConnectorBaseUrl = this.trimSlash(this.signPathGitHubConnectorBaseUrl);
    }

    buildSubmitSigningRequestUrl(): string {
        return this.signPathGitHubConnectorBaseUrl  + '/api/sign';
    }

    buildGetSigningRequestUrl(organizationId: string, signingRequestId: string): string {
        if (!this.signPathApiBaseUrl) {
            console.error('SignPath Base Url is not set');
            throw new Error('SignPath Base Url is not set');
        }

        return this.signPathApiBaseUrl  + `/v1/${encodeURIComponent(organizationId)}/SigningRequests/${encodeURIComponent(signingRequestId)}`;
    }

    private trimSlash(text: string): string {
        if(text && text[text.length - 1] === '/') {
            return text.substring(0, text.length - 1);
        }
        return text;
    }

}