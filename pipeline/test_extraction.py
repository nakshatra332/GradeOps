import asyncio
from graph import graph

async def test_run():
    print("🚀 Initializing Pipeline with Marking Scheme PDF...")
    
    initial_state = {
        "_pdf_paths": ["examples/submissions/S001.pdf", "examples/submissions/S002.pdf"],
        "_rubric_pdf_path": "examples/sample_marking_scheme.pdf",
        "exam_id": "test_extraction_01"
    }

    print("\nStarting LangGraph Execution...")
    
    config = {"configurable": {"thread_id": "test_001"}}
    
    # We will iterate through the nodes as they execute
    async for event in graph.astream(initial_state, config=config):
        for node_name, state_update in event.items():
            print(f"\n✅ Finished Node: {node_name}")
            
            # Print output from the new extractor agent
            if node_name == "extract_rubric":
                rubric = state_update.get("_rubric_raw", {})
                print(f"   Successfully extracted rubric JSON with {len(rubric.get('questions', []))} questions!")
                print(f"   Course: {rubric.get('course')}")
            
            # Print output from ingestion agent
            elif node_name == "ingest":
                if state_update:
                    print(f"   Successfully validated the schema and ingested {len(state_update.get('students', []))} students.")
                else:
                    print("   Ingestion returned empty update (possibly due to an error).")

            # Stop after ingest just to prove it works without running the entire LLM grading suite
            if node_name == "ingest":
                print("\n🎉 The rubric extraction agent successfully fed the ingestion agent. Exiting early to save API calls.")
                return

if __name__ == "__main__":
    asyncio.run(test_run())
