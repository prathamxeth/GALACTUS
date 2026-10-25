import sys
import time
import json
import httpx

BASE_URL = "http://127.0.0.1:8000"

def run_smoke_test():
    print("=" * 70)
    print("  GALACTUS BACKEND INTEGRATION & SMOKE TEST AUDIT")
    print("=" * 70)

    client = httpx.Client(base_url=BASE_URL, timeout=60.0)

    # a. Query existing memories: GET /api/memory/semantic
    print("\n[Step A] Querying existing semantic memories: GET /api/memory/semantic...")
    t0 = time.perf_counter()
    res_a = client.get("/api/memory/semantic")
    latency_a = (time.perf_counter() - t0) * 1000
    assert res_a.status_code == 200, f"Expected 200, got {res_a.status_code}: {res_a.text}"
    memories = res_a.json()
    print(f"    -> Status: {res_a.status_code} OK (Latency: {latency_a:.2f}ms)")
    print(f"    -> Retrieved {len(memories)} semantic memory records.")

    # b. Create a task requiring planning: POST /api/tasks
    goal = "Verify system security and generate report"
    print(f"\n[Step B] Submitting autonomous task: POST /api/tasks ('{goal}')...")
    t0 = time.perf_counter()
    res_b = client.post("/api/tasks", json={"goal": goal})
    latency_b = (time.perf_counter() - t0) * 1000
    assert res_b.status_code in (200, 202), f"Expected 202/200, got {res_b.status_code}: {res_b.text}"
    task_init = res_b.json()
    task_id = task_init["task_id"]
    print(f"    -> Status: {res_b.status_code} Accepted (Latency: {latency_b:.2f}ms)")
    print(f"    -> Task ID: {task_id} | Initial Status: {task_init['status']}")

    # c. Inspect task execution state: GET /api/tasks/{task_id}
    print(f"\n[Step C] Monitoring task DAG execution & planning: GET /api/tasks/{task_id}...")
    task_state = None
    for _ in range(30):
        time.sleep(1.0)
        res_c = client.get(f"/api/tasks/{task_id}")
        assert res_c.status_code == 200, f"Failed to get task: {res_c.text}"
        task_state = res_c.json()
        print(f"    -> Poll: status={task_state['status']} | subtasks={len(task_state.get('subtasks', []))}")
        if task_state["status"] in ("waiting_for_approval", "completed", "failed"):
            break

    assert task_state is not None
    print(f"    -> Reached state: {task_state['status']}")
    print(f"    -> Subtasks in plan:")
    for sub in task_state.get("subtasks", []):
        print(f"       * [{sub['subtask_id']}] {sub['title']} (Skill: {sub['skill_name']}, Risk: {sub['risk_level']}, Status: {sub['status']})")

    # d. Verify pending approvals gate: GET /api/approvals
    print("\n[Step D] Verifying pending approvals gate: GET /api/approvals...")
    t0 = time.perf_counter()
    res_d = client.get("/api/approvals")
    latency_d = (time.perf_counter() - t0) * 1000
    assert res_d.status_code == 200
    approvals = res_d.json()
    print(f"    -> Status: 200 OK (Latency: {latency_d:.2f}ms)")
    print(f"    -> Pending approvals count: {len(approvals)}")

    # Target approval
    approval_id = task_state.get("pending_approval_id")
    if not approval_id and approvals:
        for app in approvals:
            if app["task_id"] == task_id:
                approval_id = app["approval_id"]
                break

    assert approval_id is not None, f"Expected an approval to be generated for sensitive security action! Task state: {task_state}"
    print(f"    -> Found target pending approval: {approval_id}")

    # e. Resolve approval: POST /api/approvals/{approval_id} with {"decision": "approved"}
    print(f"\n[Step E] Granting human JIT approval: POST /api/approvals/{approval_id}...")
    t0 = time.perf_counter()
    res_e = client.post(f"/api/approvals/{approval_id}", json={"decision": "approved", "notes": "Smoke test authorized audit"})
    latency_e = (time.perf_counter() - t0) * 1000
    assert res_e.status_code == 200, f"Failed to approve: {res_e.text}"
    app_record = res_e.json()
    print(f"    -> Status: 200 OK (Latency: {latency_e:.2f}ms) | Approval status: {app_record['status']}")

    # Wait for task completion
    print("    -> Waiting for task to execute approved subtasks and reach COMPLETED status...")
    final_task = None
    for _ in range(40):
        time.sleep(1.0)
        res_poll = client.get(f"/api/tasks/{task_id}")
        final_task = res_poll.json()
        if final_task["status"] in ("completed", "failed"):
            break

    print(f"    -> Final Task Status: {final_task['status']}")
    assert final_task["status"] == "completed", f"Expected task to complete successfully, got: {final_task}"
    print("    -> All DAG subtasks executed successfully:")
    for sub in final_task.get("subtasks", []):
        summary = sub.get("result", {}).get("output_summary") if sub.get("result") else "N/A"
        print(f"       * [{sub['subtask_id']}] {sub['title']} -> {sub['status']} ({summary})")

    # f. Check real-time SSE stream endpoint: GET /api/tasks/{task_id}/events/stream
    print(f"\n[Step F] Checking real-time SSE stream endpoint: GET /api/tasks/{task_id}/events/stream...")
    t0 = time.perf_counter()
    events_received = []
    with client.stream("GET", f"/api/tasks/{task_id}/events/stream") as sse_stream:
        assert sse_stream.status_code == 200, f"SSE status code: {sse_stream.status_code}"
        print(f"    -> SSE Connection established (Content-Type: {sse_stream.headers.get('content-type')})")
        for line in sse_stream.iter_lines():
            if line.startswith("data: "):
                raw_payload = line[6:].strip()
                if raw_payload == "[DONE]":
                    break
                try:
                    evt = json.loads(raw_payload)
                    events_received.append(evt)
                except Exception:
                    pass
            if len(events_received) >= 5:
                break
    latency_f = (time.perf_counter() - t0) * 1000
    print(f"    -> Received {len(events_received)} SSE event stream frames successfully (Time: {latency_f:.2f}ms)")
    for evt in events_received[:4]:
        print(f"       * Event #{evt.get('sequence_id')}: {evt.get('event_type')} (Subtask: {evt.get('subtask_id')})")

    print("\n" + "=" * 70)
    print("  ALL LIVE API SMOKE TEST VERIFICATIONS PASSED 100%!")
    print("=" * 70)

if __name__ == "__main__":
    run_smoke_test()
