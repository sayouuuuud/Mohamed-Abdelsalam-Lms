import http from 'http';

const req = http.request(
  {
    hostname: 'localhost',
    port: 3000,
    path: '/api/uploadthing?actionType=upload&slug=lessonAttachment',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', data);
    });
  }
);

req.write(JSON.stringify({
  files: [{ name: 'test.pdf', size: 1024, type: 'application/pdf' }]
}));
req.end();
