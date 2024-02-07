import * as moment from 'moment';
import * as core from '@actions/core';
import { AxiosError, AxiosResponse } from 'axios';

/// function that retries promise calls with delays
/// the delays are incremental and are calculated as follows:
/// 1. start with minDelay
/// 2. double the delay on each iteration
/// 3. stop when maxTotalWaitingTimeMs is reached
/// 4. if maxDelayMs is reached, use it for all subsequent calls

export interface ExecuteWithRetriesResult<RES> {
    retry: boolean;
    retryReason?: string;
    result?: RES;
}

export async function executeWithRetries<RES>(
    promise: () => Promise<ExecuteWithRetriesResult<RES>>,
    maxTotalWaitingTimeMs: number, minDelayMs: number, maxDelayMs: number): Promise<RES> {
    const startTime = Date.now();
    let delayMs = minDelayMs;
    let result: ExecuteWithRetriesResult<RES>;
    while (true) {
        result = await promise();

        if(result.retry === false) {
            break;
        }
        else {
            if (Date.now() - startTime > maxTotalWaitingTimeMs) {
                const maxWaitingTime = moment.utc(Date.now() - startTime).format("hh:mm");
                throw new Error(result.retryReason || `The operation has timed out after ${maxWaitingTime}`);
            }
            core.info(`Next check in ${moment.duration(delayMs).humanize()}`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs = Math.min(delayMs * 2, maxDelayMs);
        }
    }
    return result.result!;
}

export function getInputNumber(name: string, options?: core.InputOptions): number {
    const value = core.getInput(name, options);
    const result = parseInt(value, 10);
    if (isNaN(result)) {
        throw new Error(`Input ${name} is not a number`);
    }
    return result;
}

export function buildSignPathAuthorizationHeader(apiToken: string): string {
    return `Bearer ${apiToken}`;
}

export function httpErrorResponseToText(err: AxiosError): string {

    const response = err.response as AxiosResponse;
    if(response && response.data) {
        // read error information from response

        // data is a string
        if(typeof(response.data) === "string") {
            return response.data;
        }
        else if(typeof(response.data) === "object") {
            return JSON.stringify(response.data);
        }
    }

    return err.message;
}