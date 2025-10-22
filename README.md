# ASD Detection Backend

A backend service for ASD (Autism Spectrum Disorder) detection and management system. This service provides REST APIs for user authentication, assessment management, child records, report generation, and real-time chat functionality.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=4000
NODE_ENV=development

# Frontend Configuration
FRONTEND_ORIGIN=http://localhost:3000

# MongoDB Configuration
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=30d

# Cloudinary Configuration (for media uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Redis Configuration (for chat)
REDIS_URL=redis://localhost:6379
```

## Dependencies

```json
{
  "bcryptjs": "^2.4.3",     // Password hashing
  "cloudinary": "^2.8.0",   // Media storage
  "cors": "^2.8.5",         // CORS support
  "csv-writer": "^1.6.0",   // CSV file generation
  "dotenv": "^16.0.3",      // Environment variables
  "express": "^4.18.2",     // Web framework
  "helmet": "^7.0.0",       // Security middleware
  "jsonwebtoken": "^9.0.0", // JWT authentication
  "mongoose": "^7.3.1",     // MongoDB ODM
  "multer": "^2.0.2",       // File upload handling
  "redis": "^5.8.3",        // Redis client
  "socket.io": "^4.8.1"     // WebSocket support
}
```

## API Endpoints

### Authentication Routes (`/api/auth`)
- **POST** `/api/auth/register`
  - Register a new user
  - Body: `{ "email": string, "password": string, "name": string }`
  - Response: `{ "token": string, "user": Object }`

- **POST** `/api/auth/login`
  - Login existing user
  - Body: `{ "email": string, "password": string }`
  - Response: `{ "token": string, "user": Object }`

### Children Routes (`/api/children`)
- **GET** `/api/children`
  - Get all children records
  - Headers: `Authorization: Bearer <token>`
  - Response: `[{ child }]`

- **POST** `/api/children`
  - Create new child record
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "name": string, "dob": date, "gender": string }`
  - Response: `{ child }`

### Assessment Routes (`/api/assessments`)
- **GET** `/api/assessments`
  - Get all assessments
  - Headers: `Authorization: Bearer <token>`
  - Response: `[{ assessment }]`

- **POST** `/api/assessments`
  - Create new assessment
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "childId": string, "type": string }`
  - Response: `{ assessment }`

### Response Routes (`/api/responses`)
- **POST** `/api/responses`
  - Submit assessment response
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "assessmentId": string, "answers": Object }`
  - Response: `{ response }`

### Reports Routes (`/api/reports`)
- **GET** `/api/reports/:childId`
  - Get reports for a child
  - Headers: `Authorization: Bearer <token>`
  - Response: `[{ report }]`

### Media Routes (`/api/media`)
- **POST** `/api/media/upload`
  - Upload media file
  - Headers: `Authorization: Bearer <token>`
  - Body: `FormData with file`
  - Response: `{ url: string }`

### Dashboard Routes (`/api/dashboard`)
- **GET** `/api/dashboard/stats`
  - Get dashboard statistics
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ stats: Object }`

### Chat Routes (`/api/chat`)
- **GET** `/api/chat/history`
  - Get chat history
  - Headers: `Authorization: Bearer <token>`
  - Response: `[{ message }]`

### WebSocket Events
The chat server supports real-time communication using Socket.IO:
- Connection: `ws://localhost:4000`
- Events:
  - `join`: Join chat room
  - `message`: Send/receive messages
  - `typing`: User typing indicator

## Project Structure
```
├── server.js           # Main application entry
├── chatServer.js       # WebSocket server setup
├── middleware/         # Express middleware
│   └── auth.js        # Authentication middleware
├── models/            # MongoDB models
├── routes/            # API routes
├── utils/             # Utility functions
└── uploads/           # Temporary upload directory
```

## Running the Project

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`

3. Start development server:
```bash
npm run dev
```

4. Start production server:
```bash
npm start
```

The server will start on http://localhost:4000 (or the specified PORT in .env).

## Security Features

- CORS protection with allowed origins
- Helmet middleware for security headers
- JWT authentication
- Password hashing with bcrypt
- Input validation
- Error handling middleware

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request