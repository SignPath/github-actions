import { assert, expect } from "chai";
import { executeWithRetries, parseUserDefinedParameters } from "../utils";

it('test execute with retries, eventually successful', async () => {
    let counter = 0;
    const promise = async () => {
        counter++;

        if (counter < 3) {
            return { retry: true, result: null };
        }

        return { retry: false, result: 'success' };
    };

    const result = await executeWithRetries(promise, 100, 1, 3);

    expect(result).to.eq('success');
});

/// the test checks that error will be thrown if the promise always fails
it('test execute with retries - error', async () => {
    const promise = async () => {
        return { retry: true, result: null };
    };

    try {
        await executeWithRetries(promise, 25, 1, 3);
        assert.fail('error should be thrown');
    }
    catch (err: any) {
        expect(err.message).contains('00:00:00'); // test formatting
        expect(err.message).contains('timed');
    }
});

it('test params parsing happy path', () => {
    const input = `param1    :  "value1"
    param2: "value2"
    param3: "value3"`;

    const result = parseUserDefinedParameters(input);

    // assert
    expect(result).to.deep.eq([
        { name: 'param1', value: 'value1' },
        { name: 'param2', value: 'value2' },
        { name: 'param3', value: 'value3' }
    ]);
});

it('test params parsing empty input', () => {
    const input = '';
    const result = parseUserDefinedParameters(input);
    expect(result).to.deep.eq([]);
});

it('test params parsing invalid input', () => {
    const input = `param1: "value1
    `;

    try {
        parseUserDefinedParameters(input);
        assert.fail('error should be thrown');
    }
    catch (err: any) {
        expect(err.message).contains('Unterminated string in JSON at position'); // original error message
        expect(err.message).contains('Invalid parameter value');
        expect(err.message).contains('value1');
    }
});

it('test params parsing invalid name', () => {
    const input = `pa*ram1: "value1"`;

    try {
        parseUserDefinedParameters(input);
        assert.fail('error should be thrown');
    }
    catch (err: any) {
        expect(err.message).contains('Invalid parameter name');
        expect(err.message).contains('pa*ram1');
    }
});

it('test params parsing empty name', () => {
    const input = `: "value1"`;

    try {
        parseUserDefinedParameters(input);
        assert.fail('error should be thrown');
    }
    catch (err: any) {
        expect(err.message).contains('Parameter name cannot be empty');
    }
});