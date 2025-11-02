#!/bin/bash

# Navigate to the client directory and start the development server
cd client
npm install
npm start &

# Navigate to the server directory and start the development server
cd ../server
npm install
npm start &

# Wait for both servers to start
wait