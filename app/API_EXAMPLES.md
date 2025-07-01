# Ilyost Voice API Examples

## Authentication

All API calls require your API key to be included in the request body.

## Base URLs

- Main API: `https://ilyost.com`
- Voice API: `https://webapi.ilyost.com`

## Example: Create a Call

```bash
curl -X POST https://webapi.ilyost.com/v2/create-call \
  -H "Content-Type: application/json" \
  -d '{
    "to_": "+1234567890",
    "from_": "+0987654321",
    "callbackurl": "https://your-server.com/webhook",
    "apikey": "YOUR_API_KEY",
    "amd": true
  }'
```

Response:
```json
{
  "success": true,
  "call_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Example: Play Text (TTS)

```bash
curl -X POST https://webapi.ilyost.com/v2/play-text \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "550e8400-e29b-41d4-a716-446655440000",
    "text": "Hello, this is a test message.",
    "voice": "en-US-JennyNeural"
  }'
```

## Example: Gather DTMF with TTS

```bash
curl -X POST https://webapi.ilyost.com/v2/gather-text \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "550e8400-e29b-41d4-a716-446655440000",
    "text": "Please enter your account number followed by pound sign.",
    "voice": "en-US-JennyNeural",
    "maxDigits": 10,
    "validDigits": "0123456789#",
    "maxTries": 3,
    "timeoutMillis": 10000
  }'
```

## Callback Webhook Format

Your callback URL will receive POST requests with the following events:

### Call Initiated
```json
{
  "state": "initiated",
  "call_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2:45:30 PM"
}
```

### Call Answered
```json
{
  "state": "answered",
  "call_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2:45:35 PM"
}
```

### AMD Result
```json
{
  "state": "amd.human",
  "call_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "HUMAN",
  "cause": "DETECTED_SPEECH",
  "timestamp": "2:45:38 PM"
}
```

### DTMF Gathered
```json
{
  "state": "dtmf.gathered",
  "call_id": "550e8400-e29b-41d4-a716-446655440000",
  "digits": "1234567890",
  "timestamp": "2:46:15 PM"
}
```

### Call Completed
```json
{
  "state": "completed",
  "call_id": "550e8400-e29b-41d4-a716-446655440000",
  "cause": "Normal Clearing",
  "actualDuration": 45,
  "billableDuration": 45,
  "billingIncrement": "6/6",
  "pricePerMinute": "0.012",
  "charge": "0.0090",
  "recording": "https://ilyost.com/recording?call_id=550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2:46:30 PM"
}
```

## Available TTS Voices

- `en-US-JennyNeural` - Female US English (Recommended)
- `en-US-GuyNeural` - Male US English
- `en-GB-SoniaNeural` - Female British English
- `en-GB-RyanNeural` - Male British English
- `en-AU-NatashaNeural` - Female Australian English
- `en-AU-WilliamNeural` - Male Australian English

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common HTTP status codes:
- `400` - Bad Request (missing or invalid parameters)
- `401` - Unauthorized (invalid API key)
- `402` - Payment Required (insufficient balance)
- `403` - Forbidden (account disabled/banned)
- `404` - Not Found (resource not found)
- `500` - Internal Server Error

## Rate Limits

- API calls: 10 requests per second
- Burst allowance: 20 requests

## Best Practices

1. **Always handle callbacks asynchronously** - Your webhook should respond with 200 OK immediately
2. **Implement retry logic** - Network issues can cause temporary failures
3. **Store call IDs** - You'll need them for subsequent API calls
4. **Monitor your balance** - Calls will fail if balance is insufficient
5. **Use webhook validation** - Verify callbacks are from our servers
6. **Handle all callback states** - Don't assume calls will always complete successfully

## SDK Examples

### Node.js
```javascript
const axios = require('axios');

class IlyostAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://webapi.ilyost.com';
  }

  async createCall(to, from, callbackUrl, amd = false) {
    const response = await axios.post(`${this.baseURL}/v2/create-call`, {
      to_: to,
      from_: from,
      callbackurl: callbackUrl,
      apikey: this.apiKey,
      amd: amd
    });
    return response.data;
  }

  async playText(callId, text, voice = 'en-US-JennyNeural') {
    const response = await axios.post(`${this.baseURL}/v2/play-text`, {
      call_id: callId,
      text: text,
      voice: voice
    });
    return response.data;
  }
}

// Usage
const api = new IlyostAPI('YOUR_API_KEY');
const call = await api.createCall('+1234567890', '+0987654321', 'https://your-server.com/webhook');
console.log('Call created:', call.call_id);
```

### Python
```python
import requests

class IlyostAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://webapi.ilyost.com'
    
    def create_call(self, to, from_number, callback_url, amd=False):
        response = requests.post(f'{self.base_url}/v2/create-call', json={
            'to_': to,
            'from_': from_number,
            'callbackurl': callback_url,
            'apikey': self.api_key,
            'amd': amd
        })
        return response.json()
    
    def play_text(self, call_id, text, voice='en-US-JennyNeural'):
        response = requests.post(f'{self.base_url}/v2/play-text', json={
            'call_id': call_id,
            'text': text,
            'voice': voice
        })
        return response.json()

# Usage
api = IlyostAPI('YOUR_API_KEY')
call = api.create_call('+1234567890', '+0987654321', 'https://your-server.com/webhook')
print(f"Call created: {call['call_id']}")
```

## Support

For technical support or questions:
- Email: support@ilyost.com
- Documentation: https://ilyost.com/documentation