<?php
/**
 * OLA VPS Cloud — fixed-IP forwarder for the WHMCS API.
 *
 * Vercel has no static egress IP and WHMCS only accepts API calls from allowlisted IPs.
 * This file runs on a server with a fixed IP (srv008, 54.37.17.20), receives the request
 * from the platform and forwards it byte for byte to WHMCS. Contract: docs/whmcs-setup.md §2.b.
 *
 * Rules it enforces:
 *  1. Only POST, only with the shared token in `X-Ola-Token` (constant-time compare).
 *  2. Only ever forwards to TARGET: any other `X-Target-Url` is refused (no open SSRF).
 *  3. Never logs or stores the body (it carries the WHMCS identifier and secret).
 *  4. Never retries, never follows redirects, 20 s timeout, IPv4 only so WHMCS sees the
 *     allowlisted IPv4 address.
 *  5. Returns WHMCS's HTTP status and body unchanged.
 *
 * Install: copy to a vhost with HTTPS on the fixed-IP server and set PROXY_TOKEN below to
 * the same value as WHMCS_PROXY_TOKEN in the platform (32+ characters), or leave it and
 * set WHMCS_PROXY_TOKEN as an environment variable of the vhost.
 */
declare(strict_types=1);

const PROXY_TOKEN = 'REPLACE_WITH_WHMCS_PROXY_TOKEN';
const TARGET = 'https://panel.cloudin.pro/includes/api.php';
const TIMEOUT_SECONDS = 20;
const MAX_BODY_BYTES = 1000000;

function refuse(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['result' => 'error', 'message' => 'proxy: ' . $message]);
    exit;
}

$started = microtime(true);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    refuse(405, 'method not allowed');
}
// The token comes from the constant above or, if that is left as is, from the
// WHMCS_PROXY_TOKEN environment variable of the vhost.
$expected = PROXY_TOKEN !== 'REPLACE_WITH_WHMCS_PROXY_TOKEN'
    ? PROXY_TOKEN
    : (string) (getenv('WHMCS_PROXY_TOKEN') ?: '');
if (strlen($expected) < 32) {
    refuse(500, 'not configured');
}

// Read a request header whatever way the front-end hands it to PHP.
function header_value(string $name): string
{
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
        return (string) $_SERVER[$key];
    }
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $header => $value) {
            if (strcasecmp((string) $header, $name) === 0) {
                return (string) $value;
            }
        }
    }
    return '';
}

// X-Ola-Token first: some Plesk/Apache setups strip any header containing "Proxy"
// (httpoxy hardening), which silently dropped the original X-Proxy-Token.
$received = header_value('X-Ola-Token');
if ($received === '') {
    $received = header_value('X-Proxy-Token');
}
// The two reasons are told apart (never the token itself) so a misconfigured
// front-end that drops the header can be diagnosed from outside.
if ($received === '') {
    refuse(401, 'unauthorized (no token received)');
}
if (!hash_equals($expected, trim($received))) {
    refuse(401, 'unauthorized (token mismatch)');
}
// The target is pinned. An absent header means "the only one"; any other value is refused.
$target = header_value('X-Target-Url');
if ($target !== '' && $target !== TARGET) {
    refuse(400, 'target not allowed');
}

$body = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
if ($body === false || strlen($body) > MAX_BODY_BYTES) {
    refuse(413, 'body too large');
}

$curl = curl_init(TARGET);
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_TIMEOUT => TIMEOUT_SECONDS,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/x-www-form-urlencoded; charset=utf-8',
        'Accept: application/json',
    ],
]);
$response = curl_exec($curl);
$status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
$contentType = (string) curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
curl_close($curl);

// Method, status and duration only: never the body, never the headers.
error_log(sprintf(
    'ola-whmcs-proxy status=%d ms=%d correlation=%s',
    $response === false ? 502 : $status,
    (int) ((microtime(true) - $started) * 1000),
    preg_replace('/[^A-Za-z0-9_.:-]/', '', header_value('X-Ola-Correlation-Id'))
));

if ($response === false) {
    refuse(502, 'upstream unreachable');
}

http_response_code($status);
if ($contentType !== '') {
    header('Content-Type: ' . $contentType);
}
echo $response;
