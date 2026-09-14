# syntax=docker/dockerfile:1.7

# ---- Build Stage ----
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp -DskipTests package

# ---- Runtime Stage ----
FROM eclipse-temurin:25-jre-alpine

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/target/*.jar app.jar

# Web 服务默认端口
EXPOSE 9090

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]