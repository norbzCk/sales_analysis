.PHONY: help build up down restart logs clean

help:
	@echo "Docker Commands:"
	@echo "  make build    - Build all Docker images"
	@echo "  make up     - Start all services"
	@echo "  make down   - Stop all services"
	@echo "  make logs   - View logs"
	@echo "  make clean  - Remove containers and volumes"

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

clean:
	docker compose down -v