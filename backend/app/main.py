from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import HealthResponse

app: FastAPI = FastAPI(title="Oroborous API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    return HealthResponse(message="Oroborous API is running", status="ok")
