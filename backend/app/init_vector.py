from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_gpdb20160503.client import Client
from alibabacloud_gpdb20160503 import models as gpdb_20160503_models
import os

ACCESS_KEY_ID = os.environ["ALIBABA_ACCESS_KEY_ID"]
ACCESS_KEY_SECRET = os.environ["ALIBABA_ACCESS_KEY_SECRET"]
INSTANCE_ID = os.environ["ADBPG_INSTANCE_ID"]
REGION_ID = os.environ["ADBPG_INSTANCE_REGION"]

def get_client():
    config = open_api_models.Config(
        access_key_id=ACCESS_KEY_ID,
        access_key_secret=ACCESS_KEY_SECRET
    )
    config.region_id = REGION_ID
    config.endpoint = f"gpdb.{REGION_ID}.aliyuncs.com"
    return Client(config)

def create_namespace(namespace, namespace_password):
    request = gpdb_20160503_models.CreateNamespaceRequest(
        region_id=REGION_ID,
        dbinstance_id=INSTANCE_ID,
        manager_account="cleantab_db",         # 你的管理员账号
        manager_account_password="CleanTabV5", # 管理员密码
        namespace=namespace,
        namespace_password=namespace_password,
    )
    resp = get_client().create_namespace(request)
    print("create_namespace status:", resp.status_code)
    print("body:", resp.body)


if __name__ == "__main__":
    # 前面 init_vector 已经 200 了，现在继续：
    create_namespace("cleantab", "CleanTabNS1")

