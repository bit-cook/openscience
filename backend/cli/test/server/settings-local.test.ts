import { afterEach, describe, expect, test } from "bun:test"
import { LocalModelsRoutes } from "../../src/server/routes/settings/local"

const app = LocalModelsRoutes()
const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

describe("/settings/local routes", () => {
  test("POST /models lists a custom endpoint's models via <baseURL>/models", async () => {
    let hit = ""
    globalThis.fetch = (async (u: any) => {
      hit = String(u)
      return Response.json({ data: [{ id: "llama3.1" }, { id: "qwen2.5" }] })
    }) as unknown as typeof fetch
    const res = await app.request("/models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "localhost:11434" }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { baseURL: string; models: string[] }
    expect(hit).toBe("http://localhost:11434/v1/models")
    expect(body.baseURL).toBe("http://localhost:11434/v1")
    expect(body.models).toEqual(["llama3.1", "qwen2.5"])
  })

  test("POST /models reports an error (200) when the endpoint is unreachable", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED")
    }) as unknown as typeof fetch
    const res = await app.request("/models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://localhost:9/v1" }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { models: string[]; error?: string }
    expect(body.models).toEqual([])
    expect(body.error).toBeTruthy()
  })

  test("GET /status reports the auto-startable runtimes with installed/running flags", async () => {
    // probe() hits real localhost ports; with nothing running they resolve to
    // not-running quickly. We assert shape + that ollama/lmstudio are present.
    globalThis.fetch = (async () => {
      throw new Error("nothing running")
    }) as unknown as typeof fetch
    const res = await app.request("/status")
    expect(res.status).toBe(200)
    const body = (await res.json()) as { runtimes: { id: string; installed: boolean; running: boolean }[] }
    const ids = body.runtimes.map((r) => r.id).sort()
    expect(ids).toEqual(["lmstudio", "ollama"])
    for (const rt of body.runtimes) {
      expect(typeof rt.installed).toBe("boolean")
      expect(rt.running).toBe(false)
    }
  })

  test("POST /start on an unknown runtime is a 400", async () => {
    const res = await app.request("/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "not-a-runtime" }),
    })
    expect(res.status).toBe(400)
  })
})
