# environment set up
FROM node:23
ENV npm_config_registry=https://registry.npmjs.org/
RUN apt-get update -y && apt-get install -y openssl
RUN useradd -ms /bin/bash admin

# install dependencies
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 8080

# user permissions
RUN chown -R admin:admin /usr/src/app
RUN chmod 755 /usr/src/app
USER admin

CMD [ "npm", "run", "start" ]