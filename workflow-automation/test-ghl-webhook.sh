#!/bin/bash

# Test webhook with a more complete GHL webhook payload
curl -X POST https://b88e83100e9b.ngrok-free.app/api/webhooks/ghl/messages \
  -H "Content-Type: application/json" \
  -H "X-GHL-Signature: test" \
  -d '{
    "type": "InboundMessage",
    "locationId": "VgOeEyKgYl9vAS8IcFLx",
    "contactId": "test-contact-123",
    "conversationId": "test-conv-123",
    "messageId": "test-msg-123",
    "message": {
      "id": "test-msg-123",
      "conversationId": "test-conv-123",
      "contactId": "test-contact-123",
      "locationId": "VgOeEyKgYl9vAS8IcFLx",
      "direction": "inbound",
      "messageType": "SMS",
      "body": "Test message with receipt",
      "attachments": [{
        "id": "test-attachment",
        "url": "https://example.com/receipt.jpg",
        "fileName": "receipt.jpg",
        "mimeType": "image/jpeg"
      }],
      "meta": {
        "phoneNumber": "+1234567890"
      },
      "dateAdded": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
      "dateUpdated": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    },
    "contact": {
      "id": "test-contact-123",
      "locationId": "VgOeEyKgYl9vAS8IcFLx",
      "phone": "+1234567890",
      "firstName": "Test",
      "lastName": "User"
    }
  }' -w "\nHTTP Status: %{http_code}\n"