# ASD Detection Backend

A backend service for ASD (Autism Spectrum Disorder) detection and management system. This service provides REST APIs for user authentication, assessment management, child records, report generation, and real-time chat functionality.

Frontend Repository: [ASD Detection Frontend](https://github.com/NavarasP/ASD_Detection_Frontend)

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

#### Register New User
- **POST** `/api/auth/register`
- Headers: None
- Body:
  ```json
  {
    "name": "string",
    "email": "string",
    "password": "string",
    "role": "string" (optional, defaults to "caregiver")
  }
  ```
- Success Response (200):
  ```json
  {
    "token": "JWT_TOKEN_STRING",
    "user": {
      "id": "string",
      "name": "string",
      "email": "string",
      "role": "string"
    }
  }
  ```
- Error Responses:
  - 400: `{ "error": "email and password required" }`
  - 409: `{ "error": "Email already in use" }`
  - 500: `{ "error": "Server error" }`

#### User Login
- **POST** `/api/auth/login`
- Headers: None
- Body:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- Success Response (200):
  ```json
  {
    "token": "JWT_TOKEN_STRING",
    "user": {
      "id": "string",
      "name": "string",
      "email": "string",
      "role": "string"
    }
  }
  ```
- Error Responses:
  - 400: `{ "error": "email and password required" }`
  - 401: `{ "error": "Invalid credentials" }`
  - 500: `{ "error": "Server error" }`

### Children Routes (`/api/children`)

#### Add New Child
- **POST** `/api/children/add`
- Headers: `Authorization: Bearer <token>`
- Body:
  ```json
  {
    "name": "string",
    "dob": "date",
    "gender": "string",
    "notes": "string" (optional)
  }
  ```
- Success Response (200):
  ```json
  {
    "_id": "string",
    "caretakerId": "string",
    "name": "string",
    "dob": "date",
    "gender": "string",
    "notes": "string",
    "createdAt": "date"
  }
  ```
- Error Response:
  - 500: `{ "error": "Error adding child" }`

#### Get My Children
- **GET** `/api/children/my`
- Headers: `Authorization: Bearer <token>`
- Success Response (200):
  ```json
  [
    {
      "_id": "string",
      "caretakerId": "string",
      "name": "string",
      "dob": "date",
      "gender": "string",
      "notes": "string",
      "createdAt": "date"
    }
  ]
  ```
- Error Response:
  - 500: `{ "error": "Error fetching children" }`

#### Update Child
- **PUT** `/api/children/:childId`
- Headers: `Authorization: Bearer <token>`
- Body:
  ```json
  {
    "name": "string" (optional),
    "dob": "date" (optional),
    "gender": "string" (optional),
    "notes": "string" (optional)
  }
  ```
- Success Response (200):
  ```json
  {
    "message": "Child updated successfully",
    "child": {
      "_id": "string",
      "caretakerId": "string",
      "name": "string",
      "dob": "date",
      "gender": "string",
      "notes": "string",
      "updatedAt": "date"
    }
  }
  ```
- Error Responses:
  - 404: `{ "error": "Child not found" }`
  - 500: `{ "error": "Error updating child" }`

#### Delete Child
- **DELETE** `/api/children/:childId`
- Headers: `Authorization: Bearer <token>`
- Success Response (200):
  ```json
  {
    "message": "Child removed"
  }
  ```
- Error Responses:
  - 404: `{ "error": "Child not found" }`
  - 500: `{ "error": "Error deleting child" }`

### Assessment Routes (`/api/assessments`)

#### Add New Assessment
- **POST** `/api/assessments/add`
- Headers: `Authorization: Bearer <token>`
- Body:
  ```json
  {
    "childId": "string",
    "type": "string",
    "answers": {
      "question1": number,
      "question2": number,
      // ... more answers
    }
  }
  ```
- Success Response (200):
  ```json
  {
    "message": "Assessment saved",
    "score": number,
    "risk": "string" (Low/Medium/High)
  }
  ```
- Error Response:
  - 500: `{ "error": "Error saving assessment" }`

#### Get Child's Assessments
- **GET** `/api/assessments/:childId`
- Headers: `Authorization: Bearer <token>`
- Success Response (200):
  ```json
  [
    {
      "_id": "string",
      "childId": "string",
      "caretakerId": "string",
      "type": "string",
      "answers": object,
      "score": number,
      "risk": "string",
      "createdAt": "date"
    }
  ]
  ```
- Error Response:
  - 500: `{ "error": "Error fetching assessments" }`

#### Get Assessment Details
- **GET** `/api/assessments/details/:assessmentId`
- Headers: `Authorization: Bearer <token>`
- Success Response (200):
  ```json
  {
    "_id": "string",
    "childId": "string",
    "caretakerId": "string",
    "type": "string",
    "answers": object,
    "score": number,
    "risk": "string",
    "createdAt": "date"
  }
  ```
- Error Responses:
  - 404: `{ "error": "Assessment not found" }`
  - 500: `{ "error": "Error fetching assessment" }`

#### Get Questionnaire Templates
- **GET** `/api/assessments/questionnaires`
- Headers: `Authorization: Bearer <token>`
- Success Response (200):
  ```json
  [
    {
      "type": "MCHAT",
      "questions": 23
    },
    {
      "type": "SCQ",
      "questions": 40
    },
    {
      "type": "TABC",
      "questions": 30
    }
  ]
  ```
- Error Response:
  - 500: `{ "error": "Error fetching templates" }`

### Response Routes (`/api/responses`)

#### Submit Response (Authenticated)
- **POST** `/api/responses/submit`
- Headers: `Authorization: Bearer <token>`
- Body:
  ```json
  {
    "childName": "string",
    "childAgeMonths": number,
    "answers": {
      "q1": number (0-3),
      "q2": number (0-3)
      // ... more question answers
    },
    "meta": {
      "device": "string",
      "locale": "string",
      "language": "string"
    }
  }
  ```
- Success Response (200):
  ```json
  {
    "id": "string",
    "prediction": {
      "riskLevel": "string" (Low/Medium/High),
      "probability": number (0-1),
      "explanation": object
    }
  }
  ```
- Error Response:
  - 400: `{ "error": "answers required" }`
  - 500: `{ "error": "Server error" }`

#### Submit Anonymous Response
- **POST** `/api/responses/submit-anon`
- Body: Same as `/submit`
- Response: Same as `/submit`

#### Get Response Details
- **GET** `/api/responses/:id`
- Headers: `Authorization: Bearer <token>`
- Success Response (200):
  ```json
  {
    "_id": "string",
    "userId": "string",
    "childName": "string",
    "childAgeMonths": number,
    "answers": object,
    "meta": {
      "device": "string",
      "locale": "string",
      "language": "string"
    },
    "prediction": {
      "riskLevel": "string",
      "probability": number,
      "explanation": object
    },
    "createdAt": "date"
  }
  ```
- Error Responses:
  - 403: `{ "error": "Forbidden" }`
  - 404: `{ "error": "Not found" }`
  - 500: `{ "error": "Server error" }`

### Reports Routes (`/api/reports`)
- **GET** `/api/reports/:childId`
  - Get reports for a child
  - Headers: `Authorization: Bearer <token>`
  - Success Response (200):
    ```json
    [
      {
        "_id": "string",
        "childId": "string",
        "type": "string",
        "data": object,
        "createdAt": "date"
      }
    ]
    ```

### Media Routes (`/api/media`)
- **POST** `/api/media/upload`
  - Upload media file
  - Headers: 
    - `Authorization: Bearer <token>`
    - `Content-Type: multipart/form-data`
  - Body: `FormData` with file field
  - Success Response (200):
    ```json
    {
      "url": "string",
      "publicId": "string"
    }
    ```

### Dashboard Routes (`/api/dashboard`)
- **GET** `/api/dashboard/stats`
  - Get dashboard statistics
  - Headers: `Authorization: Bearer <token>`
  - Success Response (200):
    ```json
    {
      "totalAssessments": number,
      "recentAssessments": number,
      "riskDistribution": {
        "low": number,
        "medium": number,
        "high": number
      },
      "childrenCount": number
    }
    ```

### Chat Routes (`/api/chat`)
- **GET** `/api/chat/history`
  - Get chat history
  - Headers: `Authorization: Bearer <token>`
  - Success Response (200):
    ```json
    [
      {
        "_id": "string",
        "userId": "string",
        "message": "string",
        "timestamp": "date",
        "type": "string"
      }
    ]
    ```

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