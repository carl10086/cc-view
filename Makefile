.PHONY: dev build test test-watch lint install clean

default: dev

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test:run

test-watch:
	pnpm test

lint:
	pnpm lint

install:
	pnpm install

clean:
	rm -rf .next node_modules
