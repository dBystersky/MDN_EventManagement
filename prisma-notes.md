# Install
Not all has to be done.
```sh
npm install typescript tsx @types/node --save-dev
npx tsc --init

npm install prisma @types/pg --save-dev
npm install @prisma/client @prisma/adapter-pg pg dotenv

npx prisma

npx prisma dev

npx prisma init --datasource-provider postgresql --output ../generated/prisma


npx prisma migrate dev --name init
npx prisma generate
```


# Scheme broke
```sh
npx prisma migrate reset
npx prisma migrate dev --name init
npx prisma generate
```

# Update Schema (TBC)
```sh
npx prisma generate
```