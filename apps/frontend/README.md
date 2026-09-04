# Plandera - Frontend

The frontend for Plandera is built with Next.js 14+, React 19, TypeScript, Tailwind CSS, and shadcn/ui components. It features client-side end-to-end encryption and a modern, responsive interface.

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **UI Library**: React 19
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Encryption**: crypto-js for client-side encryption
- **Drag & Drop**: @dnd-kit for project and task reordering
- **Form Handling**: react-hook-form with Zod validation
- **Theme**: next-themes for dark/light mode support
- **Icons**: Lucide React
- **Notifications**: Sonner for toast notifications
- **Date Handling**: date-fns

## Features

- 🎨 **Modern UI**: Beautiful, responsive interface built with shadcn/ui components
- 🌙 **Dark Mode**: Full dark/light theme support with system preference detection
- 🔒 **End-to-End Encryption**: All sensitive data encrypted client-side before transmission
- 📱 **Mobile Responsive**: Optimized for all screen sizes
- 🔄 **Real-time Updates**: WebSocket connection for instant synchronization
- 🗂️ **Drag & Drop**: Intuitive project and task reordering
- ⌨️ **Keyboard Shortcuts**: Efficient navigation and task management
- 🔍 **Search**: Fast search across projects, tasks, and calendar events
- 📅 **Calendar Views**: Multiple calendar layouts and views
- ✅ **Task Management**: Advanced todo list with priorities and due dates

## Project Structure

```text
frontend/
├── app/                    # Next.js 14+ app router
│   ├── (auth-pages)/      # Authentication pages
│   │   ├── sign-in/       # Sign in page
│   │   └── sign-up/       # Sign up page
│   ├── dashboard/         # Dashboard pages
│   │   ├── calendar/      # Calendar views
│   │   ├── projects/      # Project management
│   │   └── can-do-list/   # Todo list management
│   ├── api/               # API routes (if any)
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/                # shadcn/ui base components
│   ├── auth/              # Authentication components
│   ├── dashboard/         # Dashboard-specific components
│   └── navbar.tsx         # Navigation component
├── hooks/                 # Custom React hooks
│   ├── calendar/          # Calendar-related hooks
│   ├── can-do-list/       # Todo list hooks
│   └── cryptography/      # Encryption hooks
├── utils/                 # Utility functions
│   ├── api/               # API client and utilities
│   ├── auth/              # Authentication utilities
│   ├── calendar/          # Calendar utilities
│   ├── can-do-list/       # Todo list utilities
│   ├── context/           # React context utilities
│   ├── cryptography/      # Client-side encryption
│   └── navigation-utils.ts # Navigation helpers
├── lib/                   # Library configurations
│   └── shadcn-utils.ts    # shadcn/ui utilities
├── test/                  # Test files
│   ├── app/               # App tests
│   ├── components/        # Component tests
│   └── utils/             # Utility tests
└── public/                # Static assets
    ├── icon-192x192.png   # PWA icon
    └── icon-512x512.png   # PWA icon
```

## Environment Variables

Create a `.env.local` file in the frontend directory:

```bash
# Backend API URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001

# Optional: Additional configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Development

### Prerequisites

- Node.js 20.x or later
- pnpm (recommended) or npm

### Setup

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Set up environment variables**:

   ```bash
   cp env.example .env.local
   # Edit .env.local with your backend URL
   ```

3. **Start the development server**:

   ```bash
   pnpm dev
   ```

4. **Access the application**:
   - Frontend: <http://localhost:3000>

### Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm test` - Run tests
- `pnpm test:watch` - Run tests in watch mode

## Security Features

### Client-Side Encryption

All sensitive user data is encrypted client-side before being sent to the server:

- **Master Password**: Users provide a master password for key derivation (never sent to server)
- **PBKDF2 Key Derivation**: Strong key derivation with configurable iterations
- **AES Encryption**: AES-CBC encryption for data protection
- **Zero Knowledge**: Server never has access to unencrypted user data

### Encryption Process

1. User provides master password
2. Password is used with PBKDF2 to derive encryption key
3. All sensitive data (projects, tasks, calendar events) is encrypted client-side
4. Only encrypted data is transmitted to and stored on the server
5. Data is decrypted client-side when retrieved

## Components

The frontend uses shadcn/ui components for consistent design:

### UI Components

- **Forms**: Input, Select, Checkbox, Button components
- **Layout**: Dialog, Popover, Tabs, Card components
- **Navigation**: Dropdown Menu, Command palette
- **Feedback**: Alert Dialog, Toast notifications
- **Data Display**: Tables, Lists, Calendar views

### Custom Components

- **Navbar**: Main navigation with theme switcher
- **AuthHeader**: Authentication status and user menu
- **Dashboard Components**: Project lists, calendar views, task management
- **Encryption Components**: Master password setup, key management

## Testing

The project includes Jest and React Testing Library for testing:

- **Unit Tests**: Component and utility function tests
- **Integration Tests**: User interaction and API integration tests
- **Setup**: Test environment configured in `test/setup.ts`

Run tests:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## Build and Deployment

### Production Build

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

### Docker Deployment

The frontend includes a Dockerfile for containerized deployment:

```bash
# Build Docker image
docker build -t streamline-frontend .

# Run container
docker run -p 3000:3000 streamline-frontend
```

## API Integration

The frontend communicates with the Rust backend through:

- **REST API**: CRUD operations for projects, tasks, calendar events
- **WebSocket**: Real-time updates and synchronization
- **Authentication**: JWT-based authentication with automatic token refresh

### API Client

Located in `utils/api/`, the API client handles:

- HTTP requests to backend endpoints
- WebSocket connection management
- Authentication token management
- Error handling and retry logic
- Request/response encryption/decryption

## Contributing

When contributing to the frontend:

1. **Follow TypeScript best practices**
2. **Use existing shadcn/ui components** when possible
3. **Maintain encryption for sensitive data**
4. **Add tests for new components**
5. **Follow the existing code structure**
6. **Update this README** if adding new features

## Troubleshooting

### Common Issues

- **Build errors**: Check TypeScript errors and dependencies
- **API connection**: Verify backend URL in environment variables
- **Encryption errors**: Check master password handling
- **Theme issues**: Verify next-themes configuration

### Development Tips

- Use the browser developer tools for debugging
- Check network tab for API requests
- Use React Developer Tools for component debugging
- Test encryption/decryption flows thoroughly
