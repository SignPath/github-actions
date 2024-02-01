export class Config {
    MinDelayBetweenSigningRequestStatusChecksInSeconds = 10; // start from 10 sec
    MaxDelayBetweenSigningRequestStatusChecksInSeconds = 60 * 20; // check at least every 30 minutes
    CheckArtifactDownloadStatusIntervalInSeconds = 5;
}