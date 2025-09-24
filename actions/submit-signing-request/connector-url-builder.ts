export class ConnectorUrlBuilder {
    private readonly apiVersion: string = "1.0";
    private readonly baseSigningRequestsRoute: string;

    constructor(private readonly connectorBaseUrl: string, private readonly organizationId: string) {
        this.connectorBaseUrl = this.trimSlash(this.connectorBaseUrl);
        this.baseSigningRequestsRoute = `${this.connectorBaseUrl}/${encodeURIComponent(this.organizationId)}/SigningRequests`
    }

    public buildSubmitSigningRequestUrl(): string {
        return `${this.baseSigningRequestsRoute}?api-version=${this.apiVersion}`
    }

    public buildGetSigningRequestStatusUrl(signingRequestId: string): string {
        return `${this.baseSigningRequestsRoute}/${encodeURIComponent(signingRequestId)}/Status?api-version=${this.apiVersion}`
    }

    public buildGetSignedArtifactUrl(signingRequestId: string): string {
        return `${this.baseSigningRequestsRoute}/${encodeURIComponent(signingRequestId)}/SignedArtifact?api-version=${this.apiVersion}`
    }

    private trimSlash(text: string): string {
        if (text && text[text.length - 1] === '/') {
            return text.substring(0, text.length - 1);
        }
        return text;
    }
}