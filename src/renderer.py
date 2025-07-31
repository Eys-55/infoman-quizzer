import re
from rich.console import Console
from rich.table import Table
from rich.syntax import Syntax
from rich.panel import Panel
from rich.markdown import Markdown

console = Console()

def parse_table_data(table_content: str):
    """Parses the content of a [TABLE] block."""
    lines = [line for line in table_content.strip().split('\n') if line.strip()]
    if len(lines) < 2:
        return None, None # Not a valid table

    headers = [h.strip() for h in lines[0].split('|')]
    
    # Line 2 is separator, we skip it.
    
    rows = []
    for line in lines[2:]: # Skip header and separator
        row_data = [r.strip() for r in line.split('|')]
        # Pad row if it has fewer columns than headers
        if len(row_data) < len(headers):
             row_data.extend([''] * (len(headers) - len(row_data)))
        rows.append(row_data)
    
    return headers, rows

def render_content(content: str):
    """
    Renders card content to the console, parsing [TABLE] and [CODE] blocks.
    Also handles inline markdown like `code`.
    """
    # Regex to find [TAG=param]...[/TAG] blocks
    block_pattern = re.compile(r'\[([A-Z]+)(?:=([a-zA-Z0-9_\-]+))?\](.*?)\[/\1\]', re.DOTALL)
    
    last_end = 0
    for match in block_pattern.finditer(content):
        start, end = match.span()
        
        # Print text before the block using Markdown for inline formatting
        pre_block_text = content[last_end:start].strip()
        if pre_block_text:
            console.print(Markdown(pre_block_text, style="default"))
            
        tag_name = match.group(1)
        tag_param = match.group(2)
        block_content = match.group(3).strip()

        if tag_name == "TABLE":
            headers, rows = parse_table_data(block_content)
            if headers and rows is not None:
                table = Table(show_header=True, header_style="bold magenta")
                for header in headers:
                    table.add_column(header)
                for row in rows:
                    table.add_row(*row)
                console.print(table)
            else:
                console.print(f"[red]Could not parse table block:[/red]\n{match.group(0)}")
        
        elif tag_name == "CODE":
            lang = tag_param if tag_param else "text"
            syntax = Syntax(block_content, lang, theme="monokai", line_numbers=True, word_wrap=True)
            console.print(Panel(syntax, title=f"CODE: {lang}", border_style="green", expand=False))

        else:
            # If tag is unknown, print the block as-is
            console.print(f"[yellow]Unknown block type '{tag_name}':[/yellow]\n{match.group(0)}")

        last_end = end
        
    # Print any remaining text after the last block
    remaining_text = content[last_end:].strip()
    if remaining_text:
        console.print(Markdown(remaining_text, style="default"))