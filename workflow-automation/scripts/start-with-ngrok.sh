#!/bin/bash

echo "🚀 Starting development server with ngrok..."

# Function to check if ngrok is authenticated
check_ngrok_auth() {
    if ngrok diagnose &>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to start development server
start_dev_server() {
    echo "📦 Starting Next.js development server..."
    npm run dev &
    DEV_PID=$!
    echo "Development server started with PID: $DEV_PID"
}

# Function to start ngrok
start_ngrok() {
    echo "🌐 Waiting for development server to be ready..."
    sleep 5
    
    if check_ngrok_auth; then
        echo "✅ ngrok is authenticated, starting tunnel..."
        ngrok http 3000 &
        NGROK_PID=$!
        echo "ngrok started with PID: $NGROK_PID"
        
        # Wait a moment for ngrok to start, then show the URL
        sleep 3
        echo ""
        echo "🔗 Getting your webhook URL..."
        echo "Your webhook URL should be: https://YOUR_NGROK_URL.ngrok-free.app/api/webhooks/ghl/messages"
        echo ""
        echo "Check the ngrok web interface at: http://localhost:4040"
        echo ""
    else
        echo "❌ ngrok authentication required!"
        echo ""
        echo "Please run the following steps:"
        echo "1. Sign up: https://dashboard.ngrok.com/signup"
        echo "2. Get your authtoken: https://dashboard.ngrok.com/get-started/your-authtoken"
        echo "3. Run: ngrok config add-authtoken YOUR_AUTHTOKEN_HERE"
        echo ""
        echo "Development server is still running on http://localhost:3000"
    fi
}

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    if [ ! -z "$DEV_PID" ]; then
        kill $DEV_PID 2>/dev/null || true
    fi
    if [ ! -z "$NGROK_PID" ]; then
        kill $NGROK_PID 2>/dev/null || true
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start both services
start_dev_server
start_ngrok

# Keep script running
echo "Press Ctrl+C to stop both services"
wait 