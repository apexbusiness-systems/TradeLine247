
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    console_errors = []
    page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
    page.on('pageerror', lambda err: console_errors.append(str(err)))
    page.on('requestfailed', lambda req: console_errors.append(f'FAILED: {req.url} - {req.failure}'))

    # Also log requests to see what is being requested
    # page.on('request', lambda req: print(f'Request: {req.url}'))

    try:
        print('Navigating to http://localhost:4176')
        page.goto('http://localhost:4176')
        page.wait_for_load_state('networkidle')

        # Verify critical elements
        if not page.is_visible('#root'):
            print('ERROR: Root element not visible.')

        if console_errors:
            print('Errors found:')
            for err in console_errors:
                print(f'- {err}')
        else:
            print('No console errors.')

        page.screenshot(path='verification/csp_fix_verification.png', full_page=True)

    except Exception as e:
        print(f'An error occurred: {e}')
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
