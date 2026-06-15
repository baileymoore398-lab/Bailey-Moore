# =============================================================================
# RouteForge — developer convenience targets
# =============================================================================
# Most targets wrap docker compose; *-dev targets run services on the host.
# =============================================================================

COMPOSE ?= docker compose
BACKEND_DIR := backend
FRONTEND_DIR := frontend

.DEFAULT_GOAL := help

.PHONY: help up down logs migrate backend-dev frontend-dev test lint seed fmt build ps restart

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ---- Stack lifecycle --------------------------------------------------------
up: ## Build + start the full stack (docker compose)
	$(COMPOSE) up --build -d

build: ## Build all images without starting
	$(COMPOSE) build

down: ## Stop the stack and remove containers
	$(COMPOSE) down

restart: ## Restart the stack
	$(COMPOSE) down && $(COMPOSE) up --build -d

ps: ## Show running services
	$(COMPOSE) ps

logs: ## Tail logs for all services (S=backend to scope)
	$(COMPOSE) logs -f $(S)

# ---- Database ---------------------------------------------------------------
migrate: ## Run alembic migrations inside the backend container
	$(COMPOSE) run --rm backend alembic upgrade head

seed: ## Seed the database with sample data
	$(COMPOSE) run --rm backend python -m app.scripts.seed

# ---- Local (host) dev -------------------------------------------------------
backend-dev: ## Run the backend with autoreload on the host
	cd $(BACKEND_DIR) && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev: ## Run the Next.js dev server on the host
	cd $(FRONTEND_DIR) && npm run dev

# ---- Quality ----------------------------------------------------------------
test: ## Run backend + frontend tests
	-cd $(BACKEND_DIR) && pytest -q
	cd $(FRONTEND_DIR) && npm test --if-present

lint: ## Lint backend (ruff if present) + frontend
	-cd $(BACKEND_DIR) && (ruff check . || flake8 . || echo "no linter configured")
	cd $(FRONTEND_DIR) && npm run lint --if-present

fmt: ## Format backend (ruff/black) + frontend (prettier if present)
	-cd $(BACKEND_DIR) && (ruff format . || black . || echo "no formatter configured")
	-cd $(FRONTEND_DIR) && npx prettier --write . 2>/dev/null || echo "no prettier configured"
