.PHONY: run build test package infra-up infra-down infra-status infra-logs clean docker-build docker-run frontend-install frontend-lint frontend-build

COMPOSE = docker compose -f docker-compose.yml
FRONTEND_DIR = ../MirrorAgent-web

run:
	mvn spring-boot:run

build:
	mvn -ntp -B compile

package:
	mvn -ntp -B package -DskipTests

test:
	mvn -ntp -B test

infra-up:
	$(COMPOSE) up -d --wait

infra-down:
	$(COMPOSE) down

infra-status:
	$(COMPOSE) ps

infra-logs:
	$(COMPOSE) logs -f milvus redis mysql

docker-build:
	docker build -t mirror-agent-java .

docker-run:
	docker run --rm -p 9090:9090 --env-file .env mirror-agent-java

frontend-install:
	cd $(FRONTEND_DIR) && npm ci

frontend-lint:
	cd $(FRONTEND_DIR) && npm run lint

frontend-build:
	cd $(FRONTEND_DIR) && npm run build

clean:
	mvn -ntp -B clean