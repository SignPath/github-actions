export interface SigningRequestStatusDto {
    status: string;
    isFinalStatus: boolean;
    webLink: string;
    hasArtifactBeenDownloadedBySignPathInCaseOfArtifactRetrieval: boolean;
}
