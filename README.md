# submit-signing-request

This Submit Signing Request action allowing you to sign the build artifact using SignPath signing services.

## Usage

See [action.yml](action.yml)

### Sign published artifact and download the signed artifact back to the build agent file system

```yaml
steps:
- id: optional_step_id
  uses: signpath/github-actions/actions/submit-signing-request@v0.1
      with:
        connector-url: '<SignPath GitHub Actions connector URL>'
        api-token: '${{ secrets.SIGNPATH_API_TOKEN }}'
        organization-id: '<SignPath Organization Id>'
        project-slug: '<SignPath Project Slug>'
        signing-policy-slug: '<SignPath Policy Slug>'
        artifact-configuration-slug: '<SignPath Artifact Configuration Slug>'
        artifact-name: '<Name of the artifact to sign>'
        github-token: '${{ secrets.GITHUB_TOKEN }}'
        signed-artifact-destination-path: '<Destination path for the signed artifact>'
```

### Sign published artifact and continue workflow execution

```yaml
steps:
- id: optional_step_id
  uses: signpath/github-actions/actions/submit-signing-request@v0.1
      with:
        connector-url: '<SignPath GitHub Actions connector URL>'
        api-token: '${{ secrets.SIGNPATH_API_TOKEN }}'
        organization-id: '<SignPath Organization Id>'
        project-slug: '<SignPath Project Slug>'
        signing-policy-slug: '<SignPath Policy Slug>'
        artifact-configuration-slug: '<SignPath Artifact Configuration Slug>'
        artifact-name: '<Name of the artifact to sign>'
        github-token: '${{ secrets.GITHUB_TOKEN }}'
```

### Sign published artifact action output parameters
submit-signing-request supports the following output parameters:
- signing-request-id - The id of the newly created signing request
- signing-request-web-url - The url of the signing request in SignPath
- signpath-api-url - The base API url of the SignPath API
- signed-artifact-download-url - The url of the signed artifact in SignPath

You can use the output parameters in the following way:
```yaml
    steps:
    - name: Print the signing request id
      run:  echo "Output [${{steps.submit_signing_request_step_id.outputs.signing-request-id }}]"
```

### SignPath API token
Please make sure the API token has the following permissions:
- Reader for the specified SignPath project
- Submitter for the specified SignPath policy

### Troubleshooting
- N/A

### Known issues
- N/A