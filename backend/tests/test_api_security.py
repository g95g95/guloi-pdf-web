def test_password_set_endpoint_returns_pdf(client, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=1)
    r = client.post(
        "/api/password/set",
        files={"file": ("src.pdf", src.read_bytes(), "application/pdf")},
        data={"password": "secret123"},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    assert "attachment" in r.headers["content-disposition"]


def test_password_set_endpoint_empty_password_returns_422(client, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=1)
    r = client.post(
        "/api/password/set",
        files={"file": ("src.pdf", src.read_bytes(), "application/pdf")},
        data={"password": ""},
    )
    assert r.status_code == 422


def test_password_remove_endpoint_correct_password(client, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=1)
    set_r = client.post(
        "/api/password/set",
        files={"file": ("src.pdf", src.read_bytes(), "application/pdf")},
        data={"password": "secret123"},
    )
    assert set_r.status_code == 200

    remove_r = client.post(
        "/api/password/remove",
        files={"file": ("protetto.pdf", set_r.content, "application/pdf")},
        data={"password": "secret123"},
    )
    assert remove_r.status_code == 200
    assert remove_r.headers["content-type"] == "application/pdf"
    assert remove_r.content.startswith(b"%PDF")
    assert "attachment" in remove_r.headers["content-disposition"]


def test_password_remove_endpoint_wrong_password_returns_422(client, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=1)
    set_r = client.post(
        "/api/password/set",
        files={"file": ("src.pdf", src.read_bytes(), "application/pdf")},
        data={"password": "secret123"},
    )
    assert set_r.status_code == 200

    remove_r = client.post(
        "/api/password/remove",
        files={"file": ("protetto.pdf", set_r.content, "application/pdf")},
        data={"password": "wrongpass"},
    )
    assert remove_r.status_code == 422
    assert remove_r.json()["detail"] == "Password errata"
