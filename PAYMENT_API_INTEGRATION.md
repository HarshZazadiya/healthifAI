# Payment API Integration Guide

## Overview
This document describes the Razorpay payment integration endpoints for the SCANBO application. Two endpoints have been added to handle payment verification and webhook callbacks.

## API Endpoints

### 1. Payment Verification Endpoint
**Endpoint:** `POST /default/payment/verify`

**Purpose:** Verify payment after Razorpay redirects user back to the application.

**Request Body:**
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_xxx"
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Payment verified successfully",
  "order_id": "order_xxx",
  "payment_id": "pay_xxx",
  "wallet_balance": 5000
}
```

**Response (Failure - 400/401):**
```json
{
  "detail": "Invalid payment signature" / "Payment not captured" / "Payment record not found"
}
```

**How it works:**
1. After Razorpay checkout is successful, you receive: `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` from the Razorpay callback
2. Send these values to this endpoint to verify the payment
3. The backend verifies the HMAC-SHA256 signature
4. If valid, the payment status is marked as "completed" and wallet is updated
5. Redis cache is invalidated for the user's wallet

### 2. Razorpay Webhook Endpoint
**Endpoint:** `POST /default/payment/webhook`

**Purpose:** Handle Razorpay server-to-server webhook events for async payment confirmations.

**Request Headers:**
```
X-Razorpay-Signature: <webhook_signature>
Content-Type: application/json
```

**Request Body (payment.authorized):**
```json
{
  "event": "payment.authorized",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_xxx"
      }
    },
    "order": {
      "entity": {
        "id": "order_xxx"
      }
    }
  }
}
```

**Supported Events:**
- `payment.authorized` - Payment was captured successfully
- `payment.failed` - Payment failed

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Webhook processed successfully"
}
```

**How it works:**
1. Razorpay sends webhook events to this endpoint
2. The endpoint verifies the webhook signature using HMAC-SHA256 with the X-Razorpay-Signature header
3. If invalid signature, returns 401 Unauthorized
4. For `payment.authorized`: Updates payment record and wallet
5. For `payment.failed`: Records the failure in payment history

## Frontend Integration Example (React)

```javascript
// After Razorpay checkout success
async function handlePaymentSuccess(response) {
  try {
    const verifyResponse = await fetch('/default/payment/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      })
    });

    const result = await verifyResponse.json();
    
    if (verifyResponse.ok) {
      console.log('Payment verified! Wallet balance:', result.wallet_balance);
      // Update UI with new wallet balance
      // Show success message
    } else {
      console.error('Payment verification failed:', result.detail);
      // Show error message
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
  }
}
```

## Razorpay Configuration

### Environment Variables Required
```
RAZORPAY_TEST_API_KEY=<your_test_key>
RAZORPAY_TEST_KEY_SECRET=<your_test_secret>
CURRENCY=INR
```

### Webhook Configuration in Razorpay Dashboard
1. Go to Settings → Webhooks
2. Add webhook URL: `https://yourdomain.com/default/payment/webhook`
3. Select events:
   - payment.authorized
   - payment.failed
4. Razorpay will use X-Razorpay-Signature header for verification

## Payment Flow Diagram

```
User Frontend
     |
     | 1. POST /default/topUp (amount)
     |
     v
Backend Creates Razorpay Order
     |
     | 2. Returns razorpay_order_id
     |
     v
Frontend Opens Razorpay Checkout
     |
     | 3. User completes payment
     |
     v
Razorpay Returns to Frontend
     |
     +---> 4. POST /default/payment/verify (signature validation)
     |            |
     |            v
     |     Backend Verifies & Updates Wallet
     |
     +---> 5. Webhook Event (async confirmation)
                  |
                  v
           Backend Handles payment.authorized/failed
```

## Database Impact

### Tables Updated
- **UserPayments / DoctorPayments**
  - `razorpay_order_id` - Set after order creation
  - `razorpay_payment_id` - Set after verification
  - `payment_status` - Updated to "completed" or "failed"

- **Wallet**
  - `balance` - Incremented by top-up amount after successful verification

## Error Handling

| HTTP Code | Scenario | Action |
|-----------|----------|--------|
| 200 | Success | Wallet updated, cache invalidated |
| 400 | Bad request/verification failed | Check signature and payment status |
| 401 | Invalid signature | Webhook signature mismatch |
| 404 | Payment record not found | Payment not initiated in system |

## Security Notes

1. **Signature Verification**: All requests use HMAC-SHA256 verification
2. **Key Secret**: Stored in environment variables, never exposed
3. **Webhook Signature**: Verified against Razorpay's signature header
4. **Token Verification**: Payment verification endpoint requires valid JWT token (implicit from requester dependency in services)
5. **Webhook**: No authentication required (Razorpay uses signature verification instead)

## Testing

### Local Testing with Razorpay Test Mode
1. Use test API keys from Razorpay dashboard
2. Use test payment methods: `4111 1111 1111 1111`
3. Any future date for expiry
4. Any 3-digit CVV

### Webhook Testing
Use Razorpay webhook testing tool in the dashboard to send test webhook events.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid payment signature" | Ensure razorpay_signature is correct, check SECRET_KEY |
| "Payment record not found" | Verify order was created before verification attempt |
| "Payment not captured" | Check Razorpay dashboard to confirm payment captured status |
| Wallet not updated | Check Redis cache invalidation, verify database transaction committed |
| Webhook not received | Verify webhook URL is accessible, check Razorpay webhook logs |
