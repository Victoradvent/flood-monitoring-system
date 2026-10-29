FROM eclipse-mosquitto:2

COPY config/mosquitto.conf /mosquitto/config/mosquitto.conf
COPY config/aclfile /mosquitto/config/aclfile
RUN chown mosquitto:mosquitto /mosquitto/config/mosquitto.conf /mosquitto/config/aclfile \
    && chmod 0600 /mosquitto/config/aclfile
