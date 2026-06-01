# HealthifAI

HealthifAI is a full-stack healthcare platform powered by FastAPI, React, and AI services. It combines role-based user management, medical appointment booking, document handling, wallet/payments, and AI-assisted healthcare chat into one integrated system.

## Key Features

- Role-based access for four user types: user, doctor, hospital, and Admin
- FastAPI backend with modular routers for authentication, users, doctors, hospitals, admins, chat, and chatbot
- React frontend in Frontend/ for modern UI and user experiences
- AI chatbot with RAG search, LangChain tools, and local MCP integration
- Document upload, OCR support, and secure signed URL file handling
- Appointment booking, case tracking, hospital revenue, doctor availability, and transaction history
- Wallet and payment support with notification delivery
- Google OAuth login and admin auto-provisioning on startup
- PostgreSQL/SQLAlchemy data model, Redis support, and optional Docker Compose deployment

## Project Structure

```bash
file structure is like this : 
src/
├── AI/
│   └── local_mcp/
│   │   ├── main.py
│   │   ├── pyproject.toml
│   │   └── file_handle/
│   │       └── file_handling_server.py   # FastMCP filesystem server
│   ├── tools/
│   │   ├── user_tools.py                 # Tools available to users
│   │   ├── doctor_tools.py               # Tools available to doctor
│   │   ├── hospital_tools.py             # Tools available to hospital
│   │   ├── admin_tools.py                # Tools available to admins
│   │   └── default_tools.py              # Tools available to all roles (wallet)
│   ├── utils/
│   │   ├── state.py                      # AgentState TypedDict
│   │   └── memories.py                   # search_memory(), store_memory(), delete_memory()
│   ├── subgraphs/
│   │   ├── extractor_graph.py            # Memory extraction subgraph (Llama-3.3-70b)
│   │   └── summarizer_graph.py           # Conversation summarization subgraph (Llama-3.3-70b)
│   ├── RAG.py                            # FAISS vector store, LLM + embeddings init, search_documents tool
│   ├── graph.py                          # LangGraph graph definition, agent node, HITL logic, run_agent()
│   ├── mcp_manager.py                    # MultiServerMCPClient connecting to :8001/sse
│   └── user_config.py                    # Per-user sensitive tool settings (UserSettings table)
├── routers/
│   ├── auth.py                           # /auth — login, register user/hospital etc.
│   ├── user.py                           # /user — see doctors, trach symptoms, appointments etc.
│   ├── doctor.py                         # /doctor — see profile, see user's symptoms, give them medicine etc.
│   ├── hospital.py                       # /hospital — look at all the cases under doctors, see thier revenue etc.
│   ├── admin.py                          # /admin — platform management overlook everythign etc.
│   ├── chatbot.py                        # /chat — AI chat, threads, HITL, settings
│   └── default.py                        # /default — wallet (shared by all roles)
├── utils/
│   ├── dependencies.py                   # all dependencies
│   ├── distance_user_hospital.py         # calculate distance between user and hospitals
│   ├── document_classifer.py             # classify documents after they were uploaded if they are scannable or not
│   ├── get_current_requester.py          # get the person who is sending request by token
│   ├── get_user_pincode.py               # get user's pincode from the latitude and longitude of his
│   ├── google_credential_helper.py       # helper functions for google OAuth flow
│   ├── helper.py                         # extra helping functions
│   ├── hospital_location_getter.py       # hospital's location like lat and lon are set from the address they gave while registering
│   ├── signed_url_generator.py           # generate a signed URL for security puposes
│   └── redis_config.py                   # config for Redis setup
├── services/
│   ├── appointments.py                   # functions to help with appointments related operations.
│   ├── authenticate.py                   # check that user exists in which table
│   ├── document_handling.py              # functions to help with documents related operations.
│   ├── notification.py                   # functions to help with notifications related operations.
│   ├── payment.py                        # function to help with handle payments related operations.
│   ├── profile.py                        # helper functions for profiles
│   └── wallet.py                         # functions to help with wallet related operations.
├── documents/                            # Uploaded documents by user or doctor
├── Policies/                             # Uploaded policy documents by hospitals
├── vector_store/                         # FAISS index (built at startup, deleted at shutdown)
├── main.py                               # FastAPI app, lifespan (startup/shutdown)
├── frontend/                             # <This is where you need to make frontend files>
├── model.py                              # SQLAlchemy ORM models
├── database.py                           # Engine + SessionLocal
├── requirements.txt
└── docker-compose.yaml                   # PostgreSQL (pgvector), Redis, etcc. services
```

## AI / Chat Features

- AI chatbot support via AI/graph.py and AI/RAG.py
- Role-specific tool sets in AI/tools/ for users, doctors, hospitals, and admins
- Memory extraction and summarization subgraphs in AI/subgraphs/
- Local MCP server integration in AI/local_mcp/
- FAISS/Chroma-style vector store persisted in Vector_store/

## Setup Instructions

### 1. Install dependencies

Create and activate a virtual environment, then install Python dependencies:

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Configure environment variables

Create a .env file at the repository root with values for at least the following:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/healthifai
SECRET_KEY=your_secret_key
ALGORITHM=HS256
FRONTEND_URL=http://localhost:5173
REACT_BASE_URL=http://localhost:5173
DEFAULT_ADMIN_NAME=Admin
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=admin_password
DEFAULT_ADMIN_PHONE_NUMBER=0000000000
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

### 3. Run supporting services

If you use Docker Compose, start database and Redis services:

```bash
docker-compose up -d
```

### 4. Start the backend

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Start the frontend

Navigate into Frontend/ and install front-end dependencies if needed:

```bash
cd frontend
npm install
npm run dev
```

## Development Notes

- The backend includes a default admin creation flow on startup when no admin account exists.
- CORS is configured using FRONTEND_URL and REACT_BASE_URL environment values.
- The app exposes a health endpoint at / that returns { "message": "Health is good" }.
- AI and chatbot capabilities are assembled under AI/ using LangChain and local MCP.

## Useful Commands

```bash
# Run backend in development mode
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run frontend from the frontend directory
npm run dev

# Start Docker Compose services
docker-compose up -d
```

## Notes

- The front end should align precisely with backend API contracts and must not render fields the backend does not return.
- The platform is designed to let users track symptoms, upload medical documents, book doctors, and view estimated case costs.
- Hospitals can manage doctors and cases, while doctors can see patient details, user documents, and AI-generated priority summaries.
