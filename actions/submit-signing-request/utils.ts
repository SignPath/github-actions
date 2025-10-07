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
            const totalWaitingTimeMs = Date.now() - startTime;
            if (totalWaitingTimeMs > maxTotalWaitingTimeMs) {
                const waitingTime = moment.utc(totalWaitingTimeMs).format("HH:mm:ss");
                throw new Error(`The operation has timed out after ${waitingTime}`);
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

export function parseUserDefinedParameters(parameters: string): {name:string, value: string}[] {
    // split value by lines
    const parmLines = parameters.split('\n');
    // for each line get param name and value
    return parmLines.map(parseUseDefinedParameter)
        .filter(p => p !== null)
        .map(p => p!);
}

function parseUseDefinedParameter(line: string): { name: string, value: string } | null {
    if (!line) {
        return null;
    }
    const nameValueSeparatorIndex = line.indexOf(':');
    if (nameValueSeparatorIndex === -1) {
        throw new Error(`Invalid parameter line: ${line}`);
    }
    const name = line.substring(0, nameValueSeparatorIndex).trim();
    const value = line.substring(nameValueSeparatorIndex + 1).trim();

    // validate name
    if (!name) {
        throw new Error(`Parameter name cannot be empty. Line: ${line}`);
    }
    if(/[a-zA-Z0-9.\-_]+/.exec(name)?.[0] !== name) {
        throw new Error(`Invalid parameter name: ${name}. Only alphanumeric characters, dots, dashes and underscores are allowed.`);
    }

    // validate value
    let parsedValue = null;
    try{
        parsedValue = JSON.parse(value);
    }
    catch (e) {
        throw new Error(`Invalid parameter value: ${value} - ${e}. Only valid JSON strings are allowed.`);
    }

    if (typeof(parsedValue) !== 'string') {
        throw new Error(`Invalid parameter value: ${value}. Only valid JSON strings are allowed.`);
    }

    return { name, value: parsedValue };
}