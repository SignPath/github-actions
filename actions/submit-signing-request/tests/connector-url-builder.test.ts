import * as uuid from 'uuid';
import { assert } from "chai";
import { ConnectorUrlBuilder } from '../connector-url-builder';

const connectorUrl = "https://connector.com";
const apiVersion = "1.0"
const orgId = uuid.v4();

const sut = new ConnectorUrlBuilder(connectorUrl, orgId);

it("Should build submit signing request url correctly", () => {
    const expected = `${connectorUrl}/${orgId}/SigningRequests?api-version=${apiVersion}`
    const actual = sut.buildSubmitSigningRequestUrl();

    assert.equal(actual, expected)
})

it("Should build get signing request status url correctly", () => {
    const srId = uuid.v4();
    const expected = `${connectorUrl}/${orgId}/SigningRequests/${srId}/Status?api-version=${apiVersion}`
    const actual = sut.buildGetSigningRequestStatusUrl(srId);

    assert.equal(actual, expected)
})

it("Should build get signed artifact url correctly", () => {
    const srId = uuid.v4();
    const expected = `${connectorUrl}/${orgId}/SigningRequests/${srId}/SignedArtifact?api-version=${apiVersion}`
    const actual = sut.buildGetSignedArtifactUrl(srId);

    assert.equal(actual, expected)
})