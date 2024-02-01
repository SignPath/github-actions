export interface SigningRequestDto
{
  status: string;
  workflowStatus: string;
  signedArtifactLink: string;
  projectSlug: string;
  isFinalStatus: boolean;
  unsignedArtifactLink: string;
}
