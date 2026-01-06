# Supabase Link Automation Script
# Automates logout → login → verify → link process with error handling
# Project Ref: hysvqdwmhxnblxfqnszn

param(
    [Parameter(Mandatory=$false)]
    [string]$SupabaseToken
)

$ErrorActionPreference = "Stop"
$LogFile = "supabase-link-debug.log"
$ProjectRef = "hysvqdwmhxnblxfqnszn"
$ConfigPath = ".supabase\config.toml"

# Function to log messages with timestamp
function Write-Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] $Message"
    Write-Host $LogMessage
    Add-Content -Path $LogFile -Value $LogMessage
}

# Function to execute command and capture output
function Invoke-SupabaseCommand {
    param([string]$Command, [string]$Description)

    Write-Log "Executing: $Description"
    Write-Log "Command: $Command"

    try {
        $result = Invoke-Expression $Command 2>&1
        $exitCode = $LASTEXITCODE

        Write-Log "Exit Code: $exitCode"
        Write-Log "Output: $result"

        if ($exitCode -ne 0) {
            Write-Log "ERROR: Command failed with exit code $exitCode"
            throw "Command failed: $Command"
        }

        return $result
    }
    catch {
        Write-Log "EXCEPTION: $($_.Exception.Message)"
        throw
    }
}

# Initialize log file
if (Test-Path $LogFile) {
    Remove-Item $LogFile -Force
}
Write-Log "=== Supabase Link Automation Started ==="

try {
    # Step 1: Logout (ignore errors if not logged in)
    Write-Log "Step 1: Logging out from Supabase"
    try {
        $logoutResult = Invoke-SupabaseCommand "supabase logout" "Logout"
    }
    catch {
        Write-Log "Warning: Logout may have failed (expected if not logged in)"
    }

    # Step 2: Check if token is provided
    if (-not $SupabaseToken) {
        $SupabaseToken = $env:SUPABASE_ACCESS_TOKEN
        if (-not $SupabaseToken) {
            Write-Log "ERROR: No Supabase token provided. Use -SupabaseToken parameter or set SUPABASE_ACCESS_TOKEN environment variable"
            exit 1
        }
    }

    # Step 3: Login with token
    Write-Log "Step 2: Logging in with token"
    $loginResult = Invoke-SupabaseCommand "supabase login --token $SupabaseToken" "Login with token"

    # Step 4: Verify token by listing projects
    Write-Log "Step 3: Verifying token by listing projects"
    $projectsResult = Invoke-SupabaseCommand "supabase projects list" "List projects"

    if ($projectsResult -notmatch $ProjectRef) {
        Write-Log "ERROR: Project $ProjectRef not found in projects list. Token may be invalid or lack permissions."
        exit 1
    }
    Write-Log "SUCCESS: Project $ProjectRef found in projects list"

    # Step 5: Link to project
    Write-Log "Step 4: Linking to project $ProjectRef"
    $linkResult = Invoke-SupabaseCommand "supabase link --project-ref $ProjectRef" "Link project"

    # Step 6: Verify config.toml
    Write-Log "Step 5: Verifying .supabase/config.toml"
    if (-not (Test-Path $ConfigPath)) {
        Write-Log "ERROR: $ConfigPath not found after linking"
        exit 1
    }

    $configContent = Get-Content $ConfigPath -Raw
    if ($configContent -notmatch "project_id = `"$ProjectRef`"") {
        Write-Log "ERROR: project_id not correctly set in $ConfigPath"
        Write-Log "Config content: $configContent"
        exit 1
    }
    Write-Log "SUCCESS: $ConfigPath contains correct project_id = $ProjectRef"

    # Step 7: Final verification with supabase status
    Write-Log "Step 6: Running final verification with supabase status"
    $statusResult = Invoke-SupabaseCommand "supabase status" "Check status"

    if ($statusResult -match "not linked") {
        Write-Log "ERROR: Project still shows as not linked"
        exit 1
    }

    # Success
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Log "=== SUCCESS: Supabase link automation completed successfully at $timestamp ==="
    Write-Host "SUCCESS: Supabase project linked successfully!"
    exit 0

}
catch {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Log "=== FAILED: Supabase link automation failed at $timestamp ==="
    Write-Log "Error: $($_.Exception.Message)"
    Write-Host "FAILED: Supabase link automation failed. Check $LogFile for details."
    exit 1
}
