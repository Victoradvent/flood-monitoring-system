FROM eclipse-mosquitto:2

# SIMULATED DEVELOPMENT TLS bundle. Replace certs/config with production-managed
# files and use a secrets-aware image or volume before real deployment.
COPY config/mosquitto.conf /mosquitto/config/mosquitto.conf
COPY config/passwordfile /mosquitto/config/passwordfile
COPY config/aclfile /mosquitto/config/aclfile
COPY certs/ca.crt certs/server.crt certs/server.key /mosquitto/certs/
RUN chown mosquitto:mosquitto /mosquitto/config/mosquitto.conf /mosquitto/config/passwordfile /mosquitto/config/aclfile /mosquitto/certs/* \
    && chmod 0600 /mosquitto/config/passwordfile /mosquitto/config/aclfile /mosquitto/certs/server.key \
    && chmod 0644 /mosquitto/certs/ca.crt /mosquitto/certs/server.crt
