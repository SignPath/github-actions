import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as nodeStreamZip from 'node-stream-zip';
import axios, { AxiosError } from 'axios';
import { HelperInputOutput } from "./helper-input-output";
import { buildSignPathAuthorizationHeader, httpErrorResponseToText } from './utils';
import { TimeoutStream } from './timeout-stream';


export class HelperArtifactDownload {

    constructor(private helperInputOutput: HelperInputOutput) { }

    public async downloadSignedArtifact(artifactDownloadUrl: string): Promise<void> {
        core.info(`Signed artifact url ${artifactDownloadUrl}`);

        const timeoutMs = this.helperInputOutput.downloadSignedArtifactTimeoutInSeconds * 1000;

        const response = await axios.get(artifactDownloadUrl, {
            responseType: 'stream',
            timeout: timeoutMs,
            signal: AbortSignal.timeout(timeoutMs),
            headers: {
                Authorization: buildSignPathAuthorizationHeader(this.helperInputOutput.signPathApiToken)
            }
        })
        .catch((e: AxiosError) => {
            throw new Error(httpErrorResponseToText(e));
        });

        const targetDirectory = this.resolveOrCreateDirectory(this.helperInputOutput.outputArtifactDirectory);

        core.info(`The signed artifact is being downloaded from SignPath and will be saved to ${targetDirectory}`);

        core.info(`Going to download signed artifact`);
        const rootTmpDir = process.env.RUNNER_TEMP;
        const tmpDir = fs.mkdtempSync(`${rootTmpDir}${path.sep}`);
        core.debug(`Created temp directory ${tmpDir}`);

        // save the signed artifact to temp ZIP file
        const tmpZipFile = path.join(tmpDir, 'artifact_tmp.zip');
        const writer = fs.createWriteStream(tmpZipFile);

        const timeoutStream = new TimeoutStream({
            timeoutMs,
            errorMessage: `Timeout of ${timeoutMs} ms exceeded while downloading the signed artifact from SignPath`
        });

        response.data.pipe(timeoutStream)
            .on('timeout', (err: any) => {
                response.data.req.abort()
                response.data.emit('error', err)
            })
            .pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve)
            writer.on('error', reject)
        });

        core.debug(`The signed artifact ZIP has been saved to ${tmpZipFile}`);

        core.debug(`Extracting the signed artifact from ${tmpZipFile} to ${targetDirectory}`);
        // unzip temp ZIP file to the targetDirectory
        const zip = new nodeStreamZip.async({ file: tmpZipFile });
        await zip.extract(null, targetDirectory);
        core.info(`The signed artifact has been successfully downloaded from SignPath and extracted to ${targetDirectory}`);
    }

    private resolveOrCreateDirectory(relativePath:string): string {
        const absolutePath = path.join(process.env.GITHUB_WORKSPACE as string, relativePath)
        if (!fs.existsSync(absolutePath)) {
            core.info(`Directory "${absolutePath}" does not exist and will be created`);
            fs.mkdirSync(absolutePath, { recursive: true });
        }
        return absolutePath;
    }
}