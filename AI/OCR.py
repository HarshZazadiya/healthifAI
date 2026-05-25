import base64
import os
from dotenv import load_dotenv
from langchain_community.tools import tool
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.agents import AgentType
# def scan_prescription(image_path):
#     img = cv2.imread(image_path)

#     if img is None:
#         raise ValueError("Image not found")

#     # Resize
#     img = cv2.resize(img, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)

#     # Convert to grayscale
#     gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

#     # Remove noise
#     blur = cv2.GaussianBlur(gray, (5, 5), 0)

#     scanned = cv2.adaptiveThreshold(
#         blur,
#         255,
#         cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
#         cv2.THRESH_BINARY,
#         15,   # block size
#         3     # constant
#     )

#     # Sharpen text
#     kernel = np.array([[0,-1,0],[-1,5,-1],[0,-1,0]])
#     scanned = cv2.filter2D(scanned, -1, kernel)

#     cv2.imwrite("scanned_output.png", scanned)

#     return "scanned_output.png"

# output = scan_prescription("image.png")
# print("Saved:", output)

load_dotenv()

client = ChatGroq(
    groq_api_key=os.getenv("GROQ_API_KEY", ""),
    model_name="meta-llama/llama-4-scout-17b-16e-instruct"
)

@tool
def ocr_image(image_path):
    with open(image_path, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode("utf-8")
        # make a new file and print the encoded_string inside it
        # with open("encoded_image.txt", "w") as f:
        #     f.write(encoded_string)
    # Detect format from extension
    ext = image_path.rsplit(".", 1)[-1].lower()
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
    mime_type = mime_map.get(ext, "image/png")

    system_prompt = SystemMessage(content="""
        - You need to work as OCR, your role is to only extract what is written inside the image.
        - you do not add anything to the content, just read what is inside image and output it
        - Extract all the medicines written in the image and list them along with their dosage or days to take the medcine. 
        - If there is no medicine, just say 'No medicine found'.
        - If there is no dosage or days to take the medicine, just say 'No dosage found'.
        - Never make anything yourself, only extract what is written in the image.
        - It is critical for user, so if you cant read or understand the text, just say 'Unable to read the text'.                             
    """)

    # Send as a structured multimodal message
    message = HumanMessage(content=[
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime_type};base64,{encoded_string}"
            }
        },
        {
            "type": "text",
            "text": "Extract all text from this image."
        }
    ])

    response = client.invoke([system_prompt]+[message])
    return response.content

if __name__ == "__main__":
    image_path = "local_mcp/file_handle/workspace/doc.png"
    extracted_text = ocr_image(image_path)
    print(extracted_text)


# LANGCHAIN GEMMA-4 E2B

# import base64
# from io import BytesIO
# from PIL import Image
# import ollama

# def ask_about_image(image_path: str, prompt: str) -> str:
#     """Send image + question to Gemma 4 and get answer"""
    
#     # Convert image to base64
#     with Image.open(image_path) as img:
#         buffered = BytesIO()
#         img.save(buffered, format="JPEG")
#         img_base64 = base64.b64encode(buffered.getvalue()).decode()
    
#     # Ask Ollama
#     response = ollama.chat(
#         model='gemma4:e2b',
#         messages=[{
#             'role': 'user',
#             'content': prompt,
#             'images': [img_base64]
#         }]
#     )
    
#     return response['message']['content']

# # Usage
# if __name__ == "__main__":
#     answer = ask_about_image("scanned_output.png", "Extract all the text from image, Never make anything yourself, only extract what is written in the image. It is critical for user, so if you can't read or understand the text, just say 'Unable to read the text' All data should be extracted don't leave out anything. things like 1-0-1 are all dosage like 1 at morning, 0 at afternoon and 1 at night. If there is any text that looks like dosage or days to take the medicine, extract it and list it along with the medicine name.")
#     print(answer)