﻿$OpenCoverLogger = "/logger:Appveyor"
$BreakPoints =  Get-PSBreakpoint
$User = "appveyor"
if ($BreakPoints)
{
	# set a breakpoint anywhere in the file to run this locally...
	$OpenCoverLogger = ""
	$User = "harel"
}

# for debug, in case it is not ran from appveyor CI system:
if (!$env:APPVEYOR_BUILD_FOLDER) {
	$scriptPath = split-path -parent $MyInvocation.MyCommand.Definition
	$env:APPVEYOR_BUILD_FOLDER = (get-item $scriptPath).parent.FullName
}
if (!$env:COVERALLS_REPO_TOKEN) {
	$env:COVERALLS_REPO_TOKEN = "w3WvP9CEZ5M23oBONNsalxIgEzOmBwo9f"
}
if (!$env:APPVEYOR_REPO_COMMIT)
{
	$env:APPVEYOR_REPO_COMMIT = "178ba9471ed93c8b8a63bda2331867bb60f83829"
}
if (!$env:APPVEYOR_REPO_BRANCH)
{
	$env:APPVEYOR_REPO_BRANCH = "master"
}
if (!$env:APPVEYOR_REPO_COMMIT_AUTHOR)
{
	$env:APPVEYOR_REPO_COMMIT_AUTHOR = "Harel Mazor"
}
if (!$env:APPVEYOR_REPO_COMMIT_MESSAGE)
{
	$env:APPVEYOR_REPO_COMMIT_MESSAGE = "Debug commit message!"
}
if (!$env:APPVEYOR_JOB_ID) 
{
	$env:APPVEYOR_JOB_ID = "JobID"
}

$OpenCoverCoverageFile = "$($env:APPVEYOR_BUILD_FOLDER)\coverage-opencover.xml"
$ChutzpahJUnitFile = "$($env:APPVEYOR_BUILD_FOLDER)\chutzpah-junit.xml"
$ChutzpahCoverageFile = "$($env:APPVEYOR_BUILD_FOLDER)\coverage-chutzpah.json"

Set-Location -Path $env:APPVEYOR_BUILD_FOLDER

# Locate Chutzpah

$Chutzpah = get-childitem "C:\Users\$($User)\.nuget\packages\" chutzpah.console.exe -recurse | select-object -first 1 | select -expand FullName

# Run tests using Chutzpah and export results as JUnit format and chutzpah coveragejson for coverage

$ChutzpahCmd = "$($Chutzpah) $($env:APPVEYOR_BUILD_FOLDER)\chutzpah.json /junit $ChutzpahJUnitFile /coverage /coveragejson $ChutzpahCoverageFile"
Write-Host $ChutzpahCmd
Invoke-Expression $ChutzpahCmd

# Upload results to AppVeyor one by one
$testsuites = [xml](get-content $ChutzpahJUnitFile)

$anyFailures = $FALSE
foreach ($testsuite in $testsuites.testsuites.testsuite) {
    write-host " $($testsuite.name)"
    foreach ($testcase in $testsuite.testcase){
        $failed = $testcase.failure
        $time = $testsuite.time
        if ($testcase.time) { $time = $testcase.time }
        if ($failed) {
            write-host "Failed   $($testcase.name) $($testcase.failure.message)"
            Add-AppveyorTest $testcase.name -Outcome Failed -FileName $testsuite.name -ErrorMessage $testcase.failure.message -Duration $time
            $anyFailures = $TRUE
        }
        else {
            write-host "Passed   $($testcase.name)"
            Add-AppveyorTest $testcase.name -Outcome Passed -FileName $testsuite.name -Duration $time
        }

    }
}

# Locate Files

$OpenCover = get-ChildItem "C:\Users\$($User)\.nuget\packages\" OpenCover.Console.exe -recurse | select-object -first 1 | select -expand FullName
$VsTest = get-childitem "C:\Program Files (x86)\Microsoft Visual Studio\2017\" vstest.console.exe -recurse | Select-Object -first 1 | select -expand FullName
$DATests = get-ChildItem IsraelHiking.DataAccess.Tests.dll -recurse | Select-Object -first 1 | select -expand FullName
$APITests = get-ChildItem IsraelHiking.API.Tests.dll -recurse | Select-Object -first 1 | select -expand FullName

# Run OpenCover



$OpenCoverCmd = "$($OpenCover) -register:user -target:`"$($VsTest)`" -targetargs:`"$OpenCoverLogger $DATests $APITests`" -filter:`"+[*]*API* +[*]*Database* +[*]*GPSBabel* -[*]*JsonResponse* -[*]*GpxTypes* -[*]*Tests*`" -excludebyattribute:`"*.ExcludeFromCodeCoverage*`" -output:$OpenCoverCoverageFile"
Write-Host $OpenCoverCmd
Invoke-Expression $OpenCoverCmd

# Locate coveralls

$CoverAlls = get-childitem "C:\Users\$($User)\.nuget\packages\" csmacnz.Coveralls.exe -recurse | select-object -first 1 | select -expand FullName

# Run coveralls

$CoverAllsCmd = "$($CoverAlls) --multiple -i `"opencover=$OpenCoverCoverageFile;chutzpah=$ChutzpahCoverageFile`" --repoToken $env:COVERALLS_REPO_TOKEN --commitId $env:APPVEYOR_REPO_COMMIT --commitBranch $env:APPVEYOR_REPO_BRANCH --commitAuthor `"$env:APPVEYOR_REPO_COMMIT_AUTHOR`" --commitMessage `"$env:APPVEYOR_REPO_COMMIT_MESSAGE`" --jobId $env:APPVEYOR_JOB_ID --commitEmail none --useRelativePaths"
Write-Host $CoverAllsCmd
Invoke-Expression $CoverAllsCmd

if ($anyFailures -eq $TRUE){
    write-host "Failing build as there are broken tests"
    $host.SetShouldExit(1)
}


