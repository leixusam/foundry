/**
 * GCP (Google Cloud Platform) utilities for detecting if running on a VM
 * and for auto-stopping the instance when work is complete.
 */

import { execSync } from 'child_process';

const GCP_METADATA_URL = 'http://metadata.google.internal/computeMetadata/v1/';
const GCP_METADATA_FLAVOR = 'Metadata-Flavor: Google';

/**
 * Detect if we're running inside a Google Cloud VM by querying the metadata server.
 * The metadata server is only available from within GCP VMs and responds with
 * `Metadata-Flavor: Google` header.
 */
export async function isRunningOnGcp(): Promise<boolean> {
  try {
    // Use a short timeout since this should respond instantly if on GCP
    const response = await fetch(GCP_METADATA_URL, {
      method: 'GET',
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });

    // Check for the GCP metadata flavor header in response
    const flavor = response.headers.get('Metadata-Flavor');
    return flavor === 'Google';
  } catch {
    // If fetch fails (timeout, network error, etc.), we're not on GCP
    return false;
  }
}

/**
 * Get the current VM's instance name from GCP metadata.
 */
async function getInstanceName(): Promise<string | null> {
  try {
    const response = await fetch(`${GCP_METADATA_URL}instance/name`, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return null;
    return (await response.text()).trim();
  } catch {
    return null;
  }
}

/**
 * Get the current VM's zone from GCP metadata.
 * Returns just the zone name (e.g., 'us-central1-a'), not the full path.
 */
async function getInstanceZone(): Promise<string | null> {
  try {
    const response = await fetch(`${GCP_METADATA_URL}instance/zone`, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return null;
    // Response is like 'projects/123456/zones/us-central1-a'
    const fullZone = (await response.text()).trim();
    return fullZone.split('/').pop() || null;
  } catch {
    return null;
  }
}

/**
 * Stop the current GCP VM instance.
 * This will shut down the VM, saving compute costs.
 *
 * Uses `gcloud compute instances stop` which is available on all GCP VMs.
 * The VM must have IAM permissions to stop itself (compute.instances.stop).
 *
 * @returns true if stop command was issued successfully, false otherwise
 */
export async function stopGcpInstance(): Promise<boolean> {
  try {
    const instanceName = await getInstanceName();
    const zone = await getInstanceZone();

    if (!instanceName || !zone) {
      console.error('GCP auto-stop: Could not determine instance name or zone');
      return false;
    }

    console.log(`GCP auto-stop: Stopping instance ${instanceName} in zone ${zone}...`);

    // Use gcloud to stop the instance
    // --quiet suppresses confirmation prompts
    // Running async so the process doesn't wait for the stop to complete
    execSync(
      `gcloud compute instances stop "${instanceName}" --zone="${zone}" --quiet &`,
      { stdio: 'inherit', shell: '/bin/bash' }
    );

    return true;
  } catch (error) {
    console.error('GCP auto-stop: Failed to stop instance:', error);
    return false;
  }
}
