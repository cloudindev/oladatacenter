<?php

/**
 * OLA VPS Cloud — WHMCS -> platform webhooks.
 *
 * Install: copy this file to  <whmcs>/includes/hooks/ola_vps.php  and fill in the two
 * constants below. Nothing else in WHMCS has to change.
 *
 * It forwards three events to the platform:
 *   InvoicePaid      -> invoice.paid        (an invoice was settled inside WHMCS)
 *   InvoiceCancelled -> invoice.cancelled
 *   ClientEdit       -> client.updated      (billing details changed in the admin area)
 *
 * Request contract (verified by packages/whmcs/src/webhook.ts):
 *   POST {OLA_PLATFORM_URL}/api/webhooks/whmcs
 *   Content-Type:     application/json
 *   X-Ola-Event-Id:   stable id, identical if the same event fires twice -> idempotency key
 *   X-Ola-Timestamp:  unix seconds
 *   X-Ola-Signature:  "sha256=" + hex hmac_sha256(secret, timestamp . "." . rawBody)
 *
 * Safety: every hook body is wrapped in try/catch and every failure is written to the WHMCS
 * activity log only. A broken or slow platform must never break the WHMCS admin UI, so an
 * error here is swallowed after being logged.
 */

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

use WHMCS\Database\Capsule;

// ─── configuration ──────────────────────────────────────────────────────────
// Base URL of the platform, WITHOUT a trailing slash.
if (!defined('OLA_PLATFORM_URL')) {
    define('OLA_PLATFORM_URL', 'https://oladc.com');
}
// Must be byte-identical to WHMCS_WEBHOOK_SECRET in the platform environment.
if (!defined('OLA_WEBHOOK_SECRET')) {
    define('OLA_WEBHOOK_SECRET', 'REPLACE_WITH_WHMCS_WEBHOOK_SECRET');
}
// Set to false to mute the hook without uninstalling it.
if (!defined('OLA_WEBHOOK_ENABLED')) {
    define('OLA_WEBHOOK_ENABLED', true);
}
// Seconds. Kept short: the admin is waiting for the page to finish rendering.
if (!defined('OLA_WEBHOOK_TIMEOUT')) {
    define('OLA_WEBHOOK_TIMEOUT', 5);
}
if (!defined('OLA_WEBHOOK_CONNECT_TIMEOUT')) {
    define('OLA_WEBHOOK_CONNECT_TIMEOUT', 3);
}

// ─── transport ──────────────────────────────────────────────────────────────

/**
 * Builds the stable event id. It hashes the DATA only, never the timestamp, so the same
 * WHMCS event firing twice produces the same id and the platform can discard the duplicate.
 *
 * @param string $event
 * @param int|string $objectId
 * @param array $data
 * @return string
 */
function ola_vps_event_id($event, $objectId, array $data)
{
    $fingerprint = substr(hash('sha256', json_encode($data)), 0, 16);

    return $event . ':' . $objectId . ':' . $fingerprint;
}

/**
 * Posts one signed event. Returns true on a 2xx answer, false otherwise; never throws.
 *
 * @param string $event
 * @param int|string $objectId
 * @param array $data
 * @return bool
 */
function ola_vps_send($event, $objectId, array $data)
{
    if (!OLA_WEBHOOK_ENABLED) {
        return true;
    }

    if (OLA_WEBHOOK_SECRET === 'REPLACE_WITH_WHMCS_WEBHOOK_SECRET' || OLA_WEBHOOK_SECRET === '') {
        logActivity('OLA VPS webhook not sent: OLA_WEBHOOK_SECRET is not configured (' . $event . ')');

        return false;
    }

    if (!function_exists('curl_init')) {
        logActivity('OLA VPS webhook not sent: php-curl is not available (' . $event . ')');

        return false;
    }

    $timestamp = time();
    $eventId = ola_vps_event_id($event, $objectId, $data);

    $payload = array(
        'event' => $event,
        'eventId' => $eventId,
        'timestamp' => $timestamp,
        'data' => $data,
    );

    $rawBody = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($rawBody === false) {
        logActivity('OLA VPS webhook not sent: payload could not be encoded (' . $event . ')');

        return false;
    }

    // Exactly the string the TypeScript verifier rebuilds: timestamp + "." + raw body.
    $signature = 'sha256=' . hash_hmac('sha256', $timestamp . '.' . $rawBody, OLA_WEBHOOK_SECRET);

    $handle = curl_init(OLA_PLATFORM_URL . '/api/webhooks/whmcs');
    curl_setopt($handle, CURLOPT_POST, true);
    curl_setopt($handle, CURLOPT_POSTFIELDS, $rawBody);
    curl_setopt($handle, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($handle, CURLOPT_CONNECTTIMEOUT, OLA_WEBHOOK_CONNECT_TIMEOUT);
    curl_setopt($handle, CURLOPT_TIMEOUT, OLA_WEBHOOK_TIMEOUT);
    curl_setopt($handle, CURLOPT_FOLLOWLOCATION, false);
    // Explicit rather than relying on the php.ini defaults of whatever host WHMCS runs on:
    // the signature header must never travel over an unverified connection.
    curl_setopt($handle, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($handle, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($handle, CURLOPT_HTTPHEADER, array(
        'Content-Type: application/json',
        'Accept: application/json',
        'X-Ola-Event-Id: ' . $eventId,
        'X-Ola-Timestamp: ' . $timestamp,
        'X-Ola-Signature: ' . $signature,
        'User-Agent: ola-vps-whmcs-hook/1.0',
    ));

    $response = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    $curlError = curl_error($handle);
    curl_close($handle);

    if ($response === false || $curlError !== '') {
        logActivity('OLA VPS webhook failed (' . $event . ' ' . $eventId . '): ' . $curlError);

        return false;
    }

    if ($status < 200 || $status >= 300) {
        $body = is_string($response) ? substr($response, 0, 300) : '';
        logActivity('OLA VPS webhook rejected (' . $event . ' ' . $eventId . '): HTTP ' . $status . ' ' . $body);

        return false;
    }

    return true;
}

/**
 * Reads the invoice straight from the database: hook $vars only carry the id, and the
 * platform needs the amount and the transaction reference to reconcile with Stripe.
 *
 * @param int $invoiceId
 * @return array|null
 */
function ola_vps_invoice_data($invoiceId)
{
    $invoice = Capsule::table('tblinvoices')
        ->where('id', $invoiceId)
        ->first(array('id', 'userid', 'status', 'total', 'subtotal', 'tax', 'tax2', 'credit', 'paymentmethod'));

    if (!$invoice) {
        return null;
    }

    $transactionId = Capsule::table('tblaccounts')
        ->where('invoiceid', $invoiceId)
        ->orderBy('id', 'desc')
        ->value('transid');

    return array(
        'invoiceId' => (int) $invoice->id,
        'clientId' => (int) $invoice->userid,
        'status' => (string) $invoice->status,
        'total' => (string) $invoice->total,
        'paymentMethod' => $invoice->paymentmethod === null ? null : (string) $invoice->paymentmethod,
        'transactionId' => $transactionId === null ? null : (string) $transactionId,
    );
}

// ─── hooks ──────────────────────────────────────────────────────────────────

add_hook('InvoicePaid', 1, function ($vars) {
    try {
        $invoiceId = isset($vars['invoiceid']) ? (int) $vars['invoiceid'] : 0;
        if ($invoiceId <= 0) {
            return;
        }

        $data = ola_vps_invoice_data($invoiceId);
        if ($data === null) {
            logActivity('OLA VPS webhook skipped: invoice ' . $invoiceId . ' not found (InvoicePaid)');

            return;
        }

        ola_vps_send('invoice.paid', $invoiceId, $data);
    } catch (Exception $e) {
        logActivity('OLA VPS hook error (InvoicePaid): ' . $e->getMessage());
    } catch (Throwable $e) {
        logActivity('OLA VPS hook error (InvoicePaid): ' . $e->getMessage());
    }
});

add_hook('InvoiceCancelled', 1, function ($vars) {
    try {
        $invoiceId = isset($vars['invoiceid']) ? (int) $vars['invoiceid'] : 0;
        if ($invoiceId <= 0) {
            return;
        }

        $data = ola_vps_invoice_data($invoiceId);
        if ($data === null) {
            // A cancelled invoice is still a row, so this really should not happen.
            $data = array(
                'invoiceId' => $invoiceId,
                'clientId' => null,
                'status' => 'Cancelled',
                'total' => '0.00',
                'paymentMethod' => null,
                'transactionId' => null,
            );
        } else {
            $data['status'] = 'Cancelled';
        }

        ola_vps_send('invoice.cancelled', $invoiceId, $data);
    } catch (Exception $e) {
        logActivity('OLA VPS hook error (InvoiceCancelled): ' . $e->getMessage());
    } catch (Throwable $e) {
        logActivity('OLA VPS hook error (InvoiceCancelled): ' . $e->getMessage());
    }
});

add_hook('ClientEdit', 1, function ($vars) {
    try {
        $clientId = 0;
        if (isset($vars['userid'])) {
            $clientId = (int) $vars['userid'];
        } elseif (isset($vars['client_id'])) {
            $clientId = (int) $vars['client_id'];
        }
        if ($clientId <= 0) {
            return;
        }

        // Read the saved row rather than $vars: $vars is the submitted form, which may be
        // partial, and the platform must mirror what WHMCS actually stored.
        $client = Capsule::table('tblclients')
            ->where('id', $clientId)
            ->first(array('id', 'email', 'status', 'companyname', 'country', 'tax_id'));

        if (!$client) {
            return;
        }

        $data = array(
            'clientId' => (int) $client->id,
            'email' => (string) $client->email,
            'status' => (string) $client->status,
            'companyName' => $client->companyname === null ? null : (string) $client->companyname,
            'country' => $client->country === null ? null : (string) $client->country,
            'taxId' => $client->tax_id === null ? null : (string) $client->tax_id,
        );

        ola_vps_send('client.updated', $clientId, $data);
    } catch (Exception $e) {
        logActivity('OLA VPS hook error (ClientEdit): ' . $e->getMessage());
    } catch (Throwable $e) {
        logActivity('OLA VPS hook error (ClientEdit): ' . $e->getMessage());
    }
});
