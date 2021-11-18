import corsMiddleware from 'cors';

export const cors = corsMiddleware({
  origin: [
    'http://localhost:3000',
    'https://www.programmier.bar',
    'http://programmierbar-323408.web.app',
  ],
  methods: 'POST',
  allowedHeaders: 'Content-Type',
});
