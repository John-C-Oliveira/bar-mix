# bar-mix

## Overview
Bar-mix is a web application designed to provide a seamless experience for users to mix and manage their favorite drinks. This project consists of a client-side React application and a server-side Node.js application.

## Project Structure
```
bar-mix
├── client          # Client-side application
│   ├── src        # Source files for the React app
│   ├── package.json # Client dependencies and scripts
│   └── tsconfig.json # TypeScript configuration for client
├── server          # Server-side application
│   ├── src        # Source files for the Node.js app
│   ├── package.json # Server dependencies and scripts
│   └── tsconfig.json # TypeScript configuration for server
├── scripts         # Scripts for development and deployment
│   └── dev.sh     # Development server script
├── .gitignore      # Git ignore file
├── docker-compose.yml # Docker configuration
├── package.json    # Main project dependencies and scripts
├── tsconfig.json   # Main TypeScript configuration
└── README.md       # Project documentation
```

## Getting Started

### Prerequisites
- Node.js (version X.X.X)
- npm (version X.X.X)
- Docker (if using Docker)

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd bar-mix
   ```

2. Install dependencies for the client:
   ```
   cd client
   npm install
   ```

3. Install dependencies for the server:
   ```
   cd server
   npm install
   ```

### Running the Application
- To start the client application:
  ```
  cd client
  npm start
  ```

- To start the server application:
  ```
  cd server
  npm start
  ```

- Alternatively, you can use Docker to run the application:
  ```
  docker-compose up
  ```

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.