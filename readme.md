# Movie App API Documentation

## Base URL

```
http://localhost:3100/api
```

## Authentication

All protected routes require a Bearer token in the Authorization header:

```
Authorization: Bearer <your_token>
```

## Endpoints

### Authentication

#### Register

```
POST /auth/register
```

Body:

```json
{
  "username": "moviefan",
  "email": "user@example.com",
  "password": "securepass123"
}
```

#### Login

```
POST /auth/login
```

Body:

```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

#### Logout

```
POST /auth/logout
```

Protected route

### User Profile

#### Get Profile

```
GET /user/profile
```

Protected route

#### Update Profile

```
PUT /user/profile
```

Protected route
Body:

```json
{
  "name": "Movie Fan",
  "bio": "I love watching movies!",
  "avatar": "https://example.com/avatar.jpg",
  "preferences": {
    "genres": ["Action", "Drama"],
    "languages": ["en", "es"]
  }
}
```

### Watch History

#### Get Watch History

```
GET /recently-watched
```

Protected route

#### Add to Watch History

```
POST /recently-watched
```

Protected route
Body:

```json
{
  "movieId": "tt1234567",
  "title": "The Movie Title",
  "poster": "https://example.com/poster.jpg",
  "duration": 7200,
  "progress": 0.75
}
```

#### Delete Watch History Entry

```
DELETE /recently-watched/:id
```

Protected route

#### Clear Watch History

```
DELETE /recently-watched
```

Protected route

### Favorites

#### Get Favorites

```
GET /favorites
```

Protected route

#### Add to Favorites

```
POST /favorites
```

Protected route
Body:

```json
{
  "movieId": "tt1234567",
  "title": "The Movie Title",
  "poster": "https://example.com/poster.jpg"
}
```

#### Remove from Favorites

```
DELETE /favorites/:movieId
```

Protected route

#### Clear All Favorites

```
DELETE /favorites
```

Protected route

### Watchlist

#### Get Watchlist

```
GET /watchlist
```

Protected route

#### Add to Watchlist

```
POST /watchlist
```

Protected route
Body:

```json
{
  "movieId": "tt1234567",
  "title": "The Movie Title",
  "poster": "https://example.com/poster.jpg"
}
```

#### Remove from Watchlist

```
DELETE /watchlist/:movieId
```

Protected route

#### Clear Watchlist

```
DELETE /watchlist
```

Protected route

### Statistics

#### Get Watch Statistics

```
GET /statistics
```

Protected route

## Example Usage

### Register a New User

```javascript
fetch("http://localhost:3000/api/auth/register", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    username: "moviefan",
    email: "user@example.com",
    password: "securepass123",
  }),
});
```

### Add Movie to Watchlist

```javascript
fetch("http://localhost:3000/api/watchlist", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer your_token_here",
  },
  body: JSON.stringify({
    movieId: "tt1234567",
    title: "Inception",
    poster: "https://example.com/inception-poster.jpg",
  }),
});
```

## Error Responses

All endpoints return appropriate HTTP status codes:

- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 500: Server Error

Error response format:

```json
{
  "message": "Error description here"
}
```
