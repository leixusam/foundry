# Oneshot: Support running this inside a Google Cloud virtual machine instance

**Issue**: RSK-42
**Date**: 2025-01-25
**Status**: Complete

## What Was Done

Added GCP auto-stop feature that automatically stops the Google Cloud VM instance when Ralph has no more work to do, saving compute costs.

Key features:
1. **Automatic GCP detection**: Queries the GCP metadata server to detect if running on a Google Cloud VM
2. **Self-stopping**: Uses `gcloud compute instances stop` to stop the VM when no work is available
3. **CLI parameter**: `--gcp-auto-stop` flag to enable the feature
4. **Environment variable**: `RALPH_GCP_AUTO_STOP=true` as an alternative configuration method

## Files Changed

- `ralph/src/lib/gcp.ts` - New file: GCP detection and auto-stop utilities
  - `isRunningOnGcp()`: Detects if running on GCP by querying metadata server
  - `stopGcpInstance()`: Stops the current VM instance using gcloud CLI
- `ralph/src/types.ts` - Added `gcpAutoStop: boolean` to RalphConfig interface
- `ralph/src/config.ts` - Added CLI arg parsing and config for GCP auto-stop
  - New `--gcp-auto-stop` CLI flag
  - New `RALPH_GCP_AUTO_STOP` env var support
  - Updated help text
- `ralph/src/index.ts` - Integrated GCP auto-stop into main loop
  - Checks GCP status when no work is available
  - Stops VM if enabled and running on GCP
  - Falls back to normal sleep if not on GCP or stop fails

## Verification

- TypeScript: PASS
- Build: PASS

## Notes

### How it works

1. When no work is available and `gcpAutoStop` is enabled:
   - Query GCP metadata server at `http://metadata.google.internal/computeMetadata/v1/`
   - If response includes `Metadata-Flavor: Google` header, we're on GCP
   - Get instance name and zone from metadata
   - Run `gcloud compute instances stop` to stop the VM

2. The feature gracefully falls back to normal sleep behavior if:
   - Not running on GCP
   - GCP stop command fails (e.g., insufficient permissions)

### Prerequisites for GCP VM

For the auto-stop to work, the VM's service account needs the `compute.instances.stop` IAM permission.

### Usage examples

```bash
# Using CLI flag
npm start -- --gcp-auto-stop

# Using environment variable
RALPH_GCP_AUTO_STOP=true npm start

# Using .ralph.env file
echo "RALPH_GCP_AUTO_STOP=true" >> .ralph.env
npm start
```
